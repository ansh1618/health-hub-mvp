import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Stethoscope, Send, Loader2, AlertTriangle, CheckCircle, Info, Zap, Mic, MicOff, Volume2, Square } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { callAI } from "@/lib/ai";
import { useToast } from "@/hooks/use-toast";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";

interface DiagnosisResult {
  diseases: { name: string; probability: number; severity: "High" | "Moderate" | "Low" }[];
  recommendations: string[];
  confidence: number;
}

const severityStyles = {
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Moderate: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  Low: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};

const symptomTemplates = [
  { label: "Chest Pain", text: "Patient presents with severe chest pain radiating to left arm, shortness of breath, diaphoresis, nausea. History of hypertension and smoking for 20 years. BP 160/95, HR 110, SpO₂ 94%." },
  { label: "Diabetic Crisis", text: "Patient is a known diabetic presenting with polyuria, polydipsia, blurred vision, fatigue. Random blood sugar 420 mg/dL, HbA1c 11.2%. BMI 32. Family history of Type 2 diabetes." },
  { label: "Respiratory Distress", text: "Patient presents with acute dyspnea, productive cough with yellowish sputum, fever 39.2°C. SpO₂ 88% on room air, bilateral crackles on auscultation. History of COPD." },
  { label: "Stroke Symptoms", text: "Patient suddenly developed right-sided weakness, slurred speech, facial droop. Onset 2 hours ago. BP 180/100, HR 88. History of atrial fibrillation, non-compliant with anticoagulants." },
];

export default function Diagnosis() {
  const [symptoms, setSymptoms] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const { toast } = useToast();
  const stt = useSpeechRecognition({ lang: "en-US", continuous: true });
  const tts = useSpeechSynthesis();

  useEffect(() => {
    if (stt.transcript) {
      setSymptoms((prev) => (prev ? prev + " " : "") + stt.transcript);
      stt.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stt.transcript]);

  const toggleDictate = () => {
    if (stt.listening) stt.stop();
    else stt.start();
  };

  const readAloudResult = () => {
    if (!result) return;
    if (tts.speaking) { tts.stop(); return; }
    const diseases = result.diseases.map((d) => `${d.name}, ${d.severity} severity, ${d.probability} percent probability`).join(". ");
    const recs = result.recommendations.join(". ");
    const text = `Analysis confidence ${result.confidence} percent. Probable conditions: ${diseases}. Recommended actions: ${recs}.`;
    tts.speak(text, "English");
  };

  const handleSubmit = async () => {
    if (!symptoms.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await callAI(
        [{ role: "user", content: `Analyze these patient symptoms and provide diagnosis:\n\n${symptoms}` }],
        "diagnosis"
      );
      const jsonStr = response.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      const parsed = JSON.parse(jsonStr) as DiagnosisResult;
      setResult(parsed);
    } catch (e) {
      console.error("Diagnosis error:", e);
      toast({ title: "AI Analysis Failed", description: e instanceof Error ? e.message : "Unable to process symptoms.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AI Diagnosis Assistant</h1>
              <p className="text-sm text-muted-foreground">Describe patient symptoms for AI-powered differential diagnosis</p>
            </div>
          </div>
        </motion.div>

        {/* Quick templates */}
        <div className="flex flex-wrap gap-2">
          {symptomTemplates.map((t) => (
            <button
              key={t.label}
              onClick={() => { setSymptoms(t.text); setResult(null); }}
              className="text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
            >
              <Zap className="w-3 h-3" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="rounded-xl border border-border bg-card p-5">
          <Textarea
            placeholder="e.g., Patient presents with severe chest pain radiating to left arm, shortness of breath, diaphoresis..."
            value={symptoms + (stt.interim ? " " + stt.interim : "")}
            onChange={(e) => setSymptoms(e.target.value)}
            className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-sm focus-visible:ring-0 placeholder:text-muted-foreground/50"
          />
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-border gap-2 flex-wrap">
            <p className="text-xs text-muted-foreground">
              <Info className="w-3 h-3 inline mr-1" />
              AI-assisted — not a replacement for clinical judgment
            </p>
            <div className="flex items-center gap-2">
              {stt.supported && (
                <Button type="button" onClick={toggleDictate} variant={stt.listening ? "destructive" : "outline"} size="sm" className="text-xs px-3">
                  {stt.listening ? <MicOff className="w-3.5 h-3.5 mr-1.5" /> : <Mic className="w-3.5 h-3.5 mr-1.5" />}
                  {stt.listening ? "Stop" : "Dictate"}
                </Button>
              )}
              <Button onClick={handleSubmit} disabled={!symptoms.trim() || loading} className="gradient-primary text-primary-foreground border-0 text-xs px-4" size="sm">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Send className="w-3.5 h-3.5 mr-1.5" />}
                Analyze
              </Button>
            </div>
          </div>
          {stt.error && <p className="text-xs text-destructive mt-2">{stt.error}</p>}
        </div>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="rounded-xl border border-border bg-card p-8 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm font-medium">Running differential diagnosis...</p>
              <p className="text-xs text-muted-foreground mt-1">Analyzing symptoms against clinical knowledge base</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {result && !loading && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {/* Confidence */}
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Analysis Confidence</h3>
                  <span className={`text-lg font-bold ${result.confidence >= 70 ? "text-emerald-500" : result.confidence >= 50 ? "text-orange-500" : "text-destructive"}`}>
                    {result.confidence}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${result.confidence}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full ${result.confidence >= 70 ? "bg-emerald-500" : result.confidence >= 50 ? "bg-orange-500" : "bg-destructive"}`}
                  />
                </div>
              </div>

              {/* Read aloud */}
              {tts.supported && (
                <div className="flex justify-end">
                  <Button onClick={readAloudResult} variant="outline" size="sm" className="text-xs">
                    {tts.speaking ? <Square className="w-3.5 h-3.5 mr-1.5" /> : <Volume2 className="w-3.5 h-3.5 mr-1.5" />}
                    {tts.speaking ? "Stop reading" : "Read aloud"}
                  </Button>
                </div>
              )}

              {/* Diseases */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">Probable Conditions</h3>
                <div className="space-y-2.5">
                  {result.diseases.map((d, i) => (
                    <motion.div key={d.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{d.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-md border ${severityStyles[d.severity]}`}>{d.severity}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${d.probability}%` }} transition={{ duration: 0.6, delay: i * 0.1 }} className="h-full rounded-full bg-primary" />
                        </div>
                        <span className="text-xs font-semibold w-8 text-right">{d.probability}%</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="text-sm font-semibold mb-3">Recommended Actions</h3>
                <div className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <CheckCircle className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground">{r}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
