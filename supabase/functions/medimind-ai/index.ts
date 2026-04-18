import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { geminiGenerate, geminiStream } from "../_shared/gemini.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, mode, systemPrompt } = await req.json();
    const system = systemPrompt || systemPrompts[mode] || systemPrompts.chat;

    if (mode === "chat") {
      const stream = await geminiStream(messages, { systemInstruction: system });
      return new Response(stream, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    const content = await geminiGenerate(messages, { systemInstruction: system });
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("medimind-ai error:", e);
    const status = e?.status === 429 || e?.status === 402 ? e.status : 500;
    const msg = status === 429
      ? "Gemini rate limit hit. Please wait a moment and try again."
      : status === 402
        ? "Gemini quota exhausted. Check your Google AI Studio quota."
        : (e instanceof Error ? e.message : "Unknown error");
    return new Response(JSON.stringify({ error: msg }), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
