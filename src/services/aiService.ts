/**
 * AI service layer — calls the Gemini-backed edge function.
 * Use this from any component that needs AI features.
 */
import { supabase } from "@/integrations/supabase/client";

export type AITask = "symptoms" | "summary" | "recommendation" | "general";

export interface AIRequest {
  task: AITask;
  prompt: string;
  context?: Record<string, unknown>;
}

export interface AIResponse {
  text: string;
  raw?: unknown;
}

/**
 * Calls the gemini-ai edge function (which holds GEMINI_API_KEY server-side).
 * Throws Error on failure — callers should display via toast.
 */
export async function askGemini(req: AIRequest): Promise<AIResponse> {
  const { data, error } = await supabase.functions.invoke("gemini-ai", { body: req });

  if (error) {
    throw new Error(error.message || "Gemini request failed");
  }
  if ((data as any)?.error) {
    throw new Error((data as any).error);
  }
  return { text: (data as any)?.text ?? "", raw: data };
}

/* ---------- Convenience helpers ---------- */

export function analyzeSymptoms(symptoms: string, vitals?: Record<string, number>) {
  return askGemini({
    task: "symptoms",
    prompt: symptoms,
    context: { vitals },
  });
}

export function generateMedicalSummary(record: Record<string, unknown>) {
  return askGemini({
    task: "summary",
    prompt: "Summarize the following medical record for a clinician.",
    context: record,
  });
}

export function generateRecommendations(input: {
  riskLevel: "Low" | "Medium" | "High";
  riskScore: number;
  vitals: Record<string, number>;
  symptoms?: string;
}) {
  return askGemini({
    task: "recommendation",
    prompt: "Based on the patient's risk profile, recommend next clinical steps and lifestyle changes.",
    context: input,
  });
}
