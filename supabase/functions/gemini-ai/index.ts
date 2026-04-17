// Gemini AI edge function — uses GEMINI_API_KEY (Google AI Studio).
// Receives { task, prompt, context } from the client and returns { text }.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  symptoms:
    "You are a medical AI assistant. Given symptoms (and optionally vitals), list the 3 most likely conditions with severity (mild/moderate/severe), suggested next steps, and a clear disclaimer that this is not a diagnosis. Use short bullet points.",
  summary:
    "You are a clinical scribe. Summarize the medical record in <120 words for a busy physician. Highlight abnormal findings and red flags first.",
  recommendation:
    "You are a clinical decision support assistant. Given a patient's risk profile, give 3 prioritized recommendations: (1) immediate actions, (2) follow-up tests, (3) lifestyle advice. Be concise and practical.",
  general:
    "You are MediMind AI, a helpful medical assistant. Be concise, accurate, and always remind users to consult a qualified physician.",
};

interface ReqBody {
  task?: string;
  prompt?: string;
  context?: Record<string, unknown>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ReqBody = await req.json().catch(() => ({}));
    const task = body.task || "general";
    const prompt = (body.prompt || "").trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = SYSTEM_PROMPTS[task] || SYSTEM_PROMPTS.general;
    const userText = body.context
      ? `${prompt}\n\nContext (JSON):\n${JSON.stringify(body.context, null, 2)}`
      : prompt;

    // Direct Google Generative Language API — gemini-1.5-flash is fast & cheap.
    const model = "gemini-1.5-flash-latest";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { role: "system", parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      console.error("[gemini-ai] upstream", upstream.status, errText);
      return new Response(
        JSON.stringify({ error: `Gemini API error (${upstream.status}): ${errText.slice(0, 200)}` }),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await upstream.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";

    return new Response(JSON.stringify({ text, raw: data }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[gemini-ai] error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
