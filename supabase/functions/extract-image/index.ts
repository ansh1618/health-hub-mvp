// Gemini Vision: extracts structured medical data from a photo of a prescription, lab report, or hand-written note.
// Accepts { image_base64, mime_type } and returns the same JSON schema as extract-record.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VISION_PROMPT = `You are a medical Vision-NLP engine. The user has uploaded a photo of a medical document (prescription, lab report, discharge summary, or hand-written note).

1. Read ALL legible text from the image (OCR).
2. Extract structured data and generate risk scores.

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
  "diagnoses": ["string"],
  "family_history": "string",
  "lifestyle": "string",
  "raw_ocr_text": "string (full text you read from the image)",
  "risk_scores": {
    "diabetes": { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" },
    "cardiac":  { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" },
    "renal":    { "score": number_0_to_100, "level": "LOW|MODERATE|HIGH|CRITICAL", "reasoning": "1-sentence" }
  }
}

Rules:
- If a field is not visible in the image, use "Unknown" or empty array.
- Infer diagnoses from labs/symptoms (e.g. HbA1c > 6.5% → Type 2 Diabetes).
- Risk levels: CRITICAL >80, HIGH 60-80, MODERATE 40-60, LOW <40.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { image_base64, mime_type } = await req.json();
    if (!image_base64 || typeof image_base64 !== "string") {
      return new Response(JSON.stringify({ error: "image_base64 is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const mt = mime_type || "image/jpeg";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro", // multimodal — supports image input
        messages: [
          { role: "system", content: VISION_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract structured data from this medical document image:" },
              { type: "image_url", image_url: { url: `data:${mt};base64,${image_base64}` } },
            ],
          },
        ],
      }),
    });

    if (!upstream.ok) {
      if (upstream.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (upstream.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await upstream.text();
      console.error("Vision AI error:", upstream.status, t);
      throw new Error(`Vision AI error (${upstream.status})`);
    }

    const data = await upstream.json();
    const content = data.choices?.[0]?.message?.content || "";
    const jsonStr = content.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(jsonStr);

    return new Response(JSON.stringify({ result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("extract-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Vision extraction failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
