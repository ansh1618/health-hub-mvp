import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Browser SpeechRecognition (voice-to-text) hook.
 * Returns interim + final transcripts as the user speaks.
 */
export function useSpeechRecognition(opts?: { lang?: string; continuous?: boolean }) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const SR =
      typeof window !== "undefined" &&
      ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
    setSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    setError(null);
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setError("Voice input not supported in this browser. Try Chrome or Edge.");
      return;
    }
    const rec = new SR();
    rec.lang = opts?.lang ?? "en-US";
    rec.continuous = opts?.continuous ?? true;
    rec.interimResults = true;

    rec.onresult = (event: any) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const res = event.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      if (finalText) setTranscript((prev) => (prev ? prev + " " : "") + finalText.trim());
      setInterim(interimText);
    };
    rec.onerror = (e: any) => {
      setError(e.error || "Voice input error");
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (e: any) {
      setError(e?.message || "Could not start voice input");
    }
  }, [opts?.lang, opts?.continuous]);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterim("");
  }, []);

  return { start, stop, reset, listening, transcript, interim, supported, error };
}
