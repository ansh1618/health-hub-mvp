// Shared helper: calls Google Gemini API directly (free tier) using GEMINI_API_KEY.
// Avoids Lovable AI Gateway entirely — works with the user's own Google API key.

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Free tier model with generous quota
export const DEFAULT_MODEL = "gemini-2.0-flash";
export const VISION_MODEL = "gemini-2.0-flash";

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

/**
 * Convert OpenAI-style messages [{role: "system"|"user"|"assistant", content: string|parts}]
 * into Gemini's contents + systemInstruction format.
 */
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
          // Accept "data:<mime>;base64,<data>" URLs
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

/**
 * Call Gemini and return assistant text.
 * Throws { status, message } on failure so callers can return matching HTTP responses.
 */
export async function geminiGenerate(
  messages: Array<{ role: string; content: any }>,
  opts: GeminiOptions = {},
): Promise<string> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY is not configured"), { status: 500 });

  const model = opts.model ?? DEFAULT_MODEL;
  const { contents, systemInstruction } = toGeminiContents(messages);

  const body: any = { contents };
  if (systemInstruction || opts.systemInstruction) {
    const sys = [opts.systemInstruction, systemInstruction].filter(Boolean).join("\n\n");
    body.systemInstruction = { parts: [{ text: sys }] };
  }
  if (typeof opts.temperature === "number") {
    body.generationConfig = { temperature: opts.temperature };
  }

  const url = `${GEMINI_BASE}/${model}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("[gemini] error", resp.status, errText);
    throw Object.assign(new Error(`Gemini API error (${resp.status}): ${errText.slice(0, 200)}`), {
      status: resp.status,
    });
  }

  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join("") ?? "";
  return text;
}

/**
 * Streaming version — returns an SSE-formatted ReadableStream that mirrors OpenAI's
 * `data: {choices:[{delta:{content}}]}\n\n` shape so existing client parsers keep working.
 */
export async function geminiStream(
  messages: Array<{ role: string; content: any }>,
  opts: GeminiOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw Object.assign(new Error("GEMINI_API_KEY is not configured"), { status: 500 });

  const model = opts.model ?? DEFAULT_MODEL;
  const { contents, systemInstruction } = toGeminiContents(messages);

  const body: any = { contents };
  if (systemInstruction || opts.systemInstruction) {
    const sys = [opts.systemInstruction, systemInstruction].filter(Boolean).join("\n\n");
    body.systemInstruction = { parts: [{ text: sys }] };
  }

  const url = `${GEMINI_BASE}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok || !resp.body) {
    const errText = await resp.text().catch(() => "");
    throw Object.assign(new Error(`Gemini stream error (${resp.status}): ${errText.slice(0, 200)}`), {
      status: resp.status,
    });
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
        // Gemini SSE lines look like: "data: {json}\n\n"
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
          } catch { /* skip malformed */ }
        }
      } catch (e) {
        console.error("[gemini stream] pull error", e);
        controller.error(e);
      }
    },
    cancel() { reader.cancel(); },
  });
}
