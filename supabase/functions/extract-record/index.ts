import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXTRACTION_PROMPT = `You are a medical NLP engine. Extract structured data from the following patient record and generate risk scores.

Return ONLY valid JSON with this exact schema:
{
  "patient_name": "string",
  "age": number,
  "gender": "string (M/F)",
  "chief_complaint": "string",
  "vitals": { "BP": "string", "HR": "string", "Weight": "string", "Height": "string", "BMI": "string" },
  "lab_values": {
    "LabName": { "value": "string with units", "status": "Normal|High|Low|Critical" }
  },
  "medications": ["string"],
  "diagnoses": ["string - inferred diagnoses based on data"],
  "family_history": "string",
  "lifestyle": "string",
  "risk_scores": {
    "diabetes": { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence explanation" },
    "cardiac": { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence explanation" },
    "renal": { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence explanation" }
  }
}

Rules:
- Infer diagnoses from lab values and symptoms (e.g., HbA1c > 6.5% → Type 2 Diabetes)
- Risk scores should consider: lab values, vitals, age, family history, lifestyle, medication adherence
- Be precise with risk levels: CRITICAL (>80%), HIGH (60-80%), MODERATE (40-60%), LOW (<40%)
- If information is missing, use "Unknown" and adjust risk accordingly`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { raw_text } = await req.json();
    if (!raw_text || typeof raw_text !== "string") {
      return new Response(JSON.stringify({ error: "raw_text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: `Patient Record:\n\n${raw_text}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI service unavailable");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";

    // Parse JSON from response (handle markdown code blocks)
    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-record error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Extraction failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
