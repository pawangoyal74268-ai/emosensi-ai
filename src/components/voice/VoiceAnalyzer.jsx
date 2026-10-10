import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2, Volume2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

const MAX_DURATION = 300; // 5 minutes

export default function VoiceAnalyzer({ onAnalysisComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStep, setAnalyzingStep] = useState("");
  const [audioData, setAudioData] = useState([]);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => {
          if (prev + 1 >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);

      const visualize = () => {
        if (!analyserRef.current) return;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);
        setAudioData(Array.from(dataArray.slice(0, 32)));
        animationRef.current = requestAnimationFrame(visualize);
      };
      visualize();
    } catch (err) {
      console.error("Error accessing microphone:", err);
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    setIsRecording(false);
    setIsAnalyzing(true);

    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        stopStream();

        try {
          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          const audioFile = new File([audioBlob], "voice-recording.webm", { type: "audio/webm" });

          setAnalyzingStep("Uploading audio...");
          const uploadRes = await base44.integrations.Core.UploadFile({ file: audioFile });
          const audioUrl = uploadRes.file_url;

          setAnalyzingStep("Transcribing your voice...");
          const transcript = await base44.integrations.Core.TranscribeAudio({ audio_url: audioUrl });

          setAnalyzingStep("Analyzing emotions...");
          const analysisRes = await base44.integrations.Core.InvokeLLM({
            prompt: `You are an emotion analysis expert. Analyze this spoken transcript from a person describing how they feel today. Based on the words, tone indicators, and emotional content, determine their mood, stress level, and emotional state. Be accurate and empathetic.\n\nTranscript: "${transcript}"`,
            response_json_schema: {
              type: "object",
              properties: {
                detected_mood: {
                  type: "string",
                  enum: ["happy", "calm", "neutral", "anxious", "sad", "stressed", "angry"],
                },
                mood_score: { type: "number", description: "Mood score 1-10 (10 = very positive)" },
                stress_level: { type: "number", description: "Stress level 1-10" },
                confidence: { type: "number", description: "Confidence percentage 0-100" },
                summary: { type: "string", description: "Brief empathetic summary of what was detected" },
              },
            },
          });

          const avgEnergy = audioData.length > 0 ? audioData.reduce((a, b) => a + b, 0) / audioData.length : 50;

          const analysis = {
            transcript,
            detected_mood: analysisRes.detected_mood || "neutral",
            mood_score: analysisRes.mood_score || 5,
            stress_level: analysisRes.stress_level || 5,
            confidence: analysisRes.confidence || 75,
            summary: analysisRes.summary || "",
            pitch: avgEnergy * 3 + 80,
            energy: avgEnergy,
            tempo: Math.round(60 + (avgEnergy / 255) * 80),
          };

          setIsAnalyzing(false);
          setAnalyzingStep("");
          onAnalysisComplete(analysis);
          resolve();
        } catch (err) {
          console.error("Analysis error:", err);
          setIsAnalyzing(false);
          setAnalyzingStep("");
          onAnalysisComplete({
            transcript: "",
            detected_mood: "neutral",
            mood_score: 5,
            stress_level: 5,
            confidence: 50,
            summary: "Analysis could not be completed. Please try again.",
            pitch: 120,
            energy: 50,
            tempo: 90,
          });
          resolve();
        }
      };

      mediaRecorderRef.current.stop();
    });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = (duration / MAX_DURATION) * 100;

  return (
    <div className="rounded-3xl bg-white border border-slate-100 p-8" style={{ boxShadow: "0 4px 30px -8px rgba(124,58,237,0.08)" }}>
      <div className="text-center space-y-6">
        <div className="space-y-1.5">
          <h3 className="text-xl font-semibold text-slate-800">Daily Voice Check-in</h3>
          <p className="text-sm text-slate-400">
            Speak for up to 5 minutes about how you're feeling today
          </p>
        </div>

        {/* Visualizer */}
        <div className="relative h-40 flex items-center justify-center">
          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div
                key="recording"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-end justify-center gap-1 h-32"
              >
                {audioData.map((value, i) => (
                  <motion.div
                    key={i}
                    className="w-2 bg-gradient-to-t from-violet-500 to-purple-400 rounded-full"
                    animate={{ height: Math.max(4, value / 2) }}
                    transition={{ duration: 0.05 }}
                  />
                ))}
              </motion.div>
            ) : isAnalyzing ? (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4"
              >
                <div className="relative w-20 h-20">
                  <motion.div
                    animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full bg-violet-300"
                  />
                  <motion.div
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
                    className="absolute inset-2 rounded-full bg-violet-400"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Volume2 className="w-8 h-8 text-violet-600" />
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-600">{analyzingStep || "Analyzing..."}</p>
                  <p className="text-xs text-slate-400 mt-1">Understanding your emotional signals</p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative"
              >
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
                  <Mic className="w-12 h-12 text-violet-500" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.1, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-violet-300"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Timer & Progress */}
        {isRecording && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2.5">
            <div className="flex items-center justify-center gap-2 text-2xl font-mono text-violet-600">
              <Clock className="w-5 h-5" />
              {formatTime(duration)}
              <span className="text-sm text-slate-400">/ 5:00</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <motion.div
                animate={{ width: `${progress}%` }}
                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full"
              />
            </div>
          </motion.div>
        )}

        {/* Controls */}
        <div className="flex justify-center">
          {!isRecording && !isAnalyzing ? (
            <Button
              onClick={startRecording}
              size="lg"
              className="rounded-full px-8 h-12 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 border-0"
              style={{ boxShadow: "0 4px 16px -2px rgba(124,58,237,0.3)" }}
            >
              <Mic className="w-5 h-5 mr-2" />
              Start 5-Min Check-in
            </Button>
          ) : isRecording ? (
            <Button
              onClick={stopRecording}
              size="lg"
              variant="destructive"
              className="rounded-full px-8 h-12"
            >
              <Square className="w-5 h-5 mr-2" />
              Stop & Analyze
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}