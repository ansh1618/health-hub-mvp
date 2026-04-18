const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_MODEL = "gemini-2.5-flash";
export const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-1.5-flash"];
export const VISION_MODEL = "gemini-2.5-flash";

export interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

export interface GeminiMessage {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiOptions {
  model?: string;
  systemInstruction?: string;
  temperature?: number;
}

export function toGeminiContents(
  messages: Array<{ role: string; content: any }>,
): { contents: GeminiMessage[]; systemInstruction?: string } {
  let systemInstruction: string | undefined;
  const contents: GeminiMessage[] = [];

  for (const m of messages) {
    if (m.role === "system") {
      systemInstruction = (systemInstruction ? systemInstruction + "\n\n" : "") +
        (typeof m.content === "string" ? m.content : JSON.stringify(m.content));
      continue;
    }
    const role: "user" | "model" = m.role === "assistant" ? "model" : "user";
    if (typeof m.content === "string") {
      contents.push({ role, parts: [{ text: m.content }] });
    } else if (Array.isArray(m.content)) {
      const parts: GeminiPart[] = [];
      for (const p of m.content) {
        if (p.type === "text") parts.push({ text: p.text });
        else if (p.type === "image_url") {
          const url = p.image_url?.url ?? "";
          const match = url.match(/^data:([^;]+);base64,(.+)$/);
          if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
        }
      }
      contents.push({ role, parts });
    }
  }
  return { contents, systemInstruction };
}

function buildRequestBody(
  messages: Array<{ role: string; content: any }>,
  opts: GeminiOptions = {},
) {
  const { contents, systemInstruction } = toGeminiContents(messages);
  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: typeof opts.temperature === "number" ? opts.temperature : 0.2,
      maxOutputTokens: 4096,
    },
  };

  if (systemInstruction || opts.systemInstruction) {
    const sys = [opts.systemInstruction, systemInstruction].filter(Boolean).join("\n\n");
    body.systemInstruction = { parts: [{ text: sys }] };
  }

  return body;
}

async function readGeminiError(resp: Response) {
  const errText = await resp.text().catch(() => "");
  console.error("[gemini] error", resp.status, errText);

  let retryAfterSeconds: number | undefined;
  const retryHeader = resp.headers.get("retry-after");
  if (retryHeader && !Number.isNaN(Number(retryHeader))) {
    retryAfterSeconds = Number(retryHeader);
  }

  const retryInfoMatch = errText.match(/retry in\s+(\d+(?:\.\d+)?)s/i);
  if (!retryAfterSeconds && retryInfoMatch) {
    retryAfterSeconds = Math.ceil(Number(retryInfoMatch[1]));
  }

  const error = Object.assign(
    new Error(`Gemini API error (${resp.status}): ${errText.slice(0, 300)}`),
    {
      status: resp.status,
      retryAfterSeconds,
      raw: errText,
    },
  );

  return error;
}

async function fetchWithModelFallback(
  endpoint: "generateContent" | "streamGenerateContent?alt=sse",
  messages: Array<{ role: string; content: any }>,
  opts: GeminiOptions = {},
): Promise<Response> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY is not configured"), { status: 500 });

  const models = [opts.model ?? DEFAULT_MODEL, ...FALLBACK_MODELS];
  const body = buildRequestBody(messages, opts);
  let lastError: Error | null = null;

  for (const model of models) {
    const url = `${GEMINI_BASE}/${model}:${endpoint}&key=${apiKey}`.replace(":generateContent&", ":generateContent?");
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (resp.ok) return resp;

    const error = await readGeminiError(resp);
    lastError = error;

    if (resp.status !== 429 && resp.status !== 503) {
      throw error;
    }
  }

  throw lastError ?? Object.assign(new Error("Gemini request failed"), { status: 500 });
}

export async function geminiGenerate(
  messages: Array<{ role: string; content: any }>,
  opts: GeminiOptions = {},
): Promise<string> {
  const resp = await fetchWithModelFallback("generateContent", messages, opts);
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "";
  return text;
}

export async function geminiStream(
  messages: Array<{ role: string; content: any }>,
  opts: GeminiOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const resp = await fetchWithModelFallback("streamGenerateContent?alt=sse", messages, opts);
  if (!resp.body) {
    throw Object.assign(new Error("Gemini stream response missing body"), { status: 500 });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = resp.body.getReader();

  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (!json) continue;
          try {
            const parsed = JSON.parse(json);
            const text = parsed?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "";
            if (text) {
              const openaiShape = JSON.stringify({ choices: [{ delta: { content: text } }] });
              controller.enqueue(encoder.encode(`data: ${openaiShape}\n\n`));
            }
          } catch {
          }
        }
      } catch (e) {
        console.error("[gemini stream] pull error", e);
        controller.error(e);
      }
    },
    cancel() {
      reader.cancel();
    },
  });
}
