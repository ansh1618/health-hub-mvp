import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, systemPrompt } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompts: Record<string, string> = {
      chat: `You are MediMind AI, an advanced clinical assistant for doctors. You have access to patient data and can help analyze conditions, recommend treatments, and explain medical concepts. Be concise, professional, and always note that AI suggestions should be verified by clinical judgment. Use markdown formatting for readability.`,
      diagnosis: `You are a medical AI diagnosis assistant. Given patient symptoms, provide:
1. A list of probable conditions with estimated probability percentages and severity (High/Moderate/Low)
2. Recommended diagnostic actions
3. A confidence score for your overall analysis (0-100%)
Respond ONLY with valid JSON in this exact format:
{"diseases":[{"name":"string","probability":number,"severity":"High|Moderate|Low"}],"recommendations":["string"],"confidence":number}`,
      report: `You are a medical report analyzer. Given a medical report description, provide:
1. A title for the report
2. A brief clinical summary
3. Key findings with status (normal/abnormal/critical)
4. A plain-language explanation for the patient
Respond ONLY with valid JSON in this exact format:
{"title":"string","summary":"string","keyFindings":[{"finding":"string","status":"normal|abnormal|critical"}],"simplifiedExplanation":"string"}`,
    };

    const system = systemPrompt || systemPrompts[mode] || systemPrompts.chat;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: system },
          ...messages,
        ],
        stream: mode === "chat",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in workspace settings." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service unavailable" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "chat") {
      return new Response(response.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("medimind-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
