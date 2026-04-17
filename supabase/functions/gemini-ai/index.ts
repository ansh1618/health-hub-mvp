// Gemini AI edge function — routed through Lovable AI Gateway (no user API key needed).
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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
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

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText },
        ],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await upstream.text();
      console.error("[gemini-ai] upstream", upstream.status, errText);
      return new Response(
        JSON.stringify({ error: `AI gateway error (${upstream.status})` }),
        { status: upstream.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await upstream.json();
    const text = data?.choices?.[0]?.message?.content ?? "";

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
