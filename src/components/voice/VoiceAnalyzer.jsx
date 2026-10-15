import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Volume2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import apiClient from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

const MAX_DURATION = 300; // 5 minutes

export default function VoiceAnalyzer({ onAnalysisComplete }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingStep, setAnalyzingStep] = useState("");
  const [errorMessage, setErrorMessage] = useState(null);
  const [audioData, setAudioData] = useState([]);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const transcriptAccumulatorRef = useRef("");

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
      }
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
    if (!isAuthenticated) {
      toast.error("Please sign in to record a voice check-in.");
      openAuthModal();
      return;
    }

    try {
      setErrorMessage(null);
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

      // Initialize Web Speech API for browser-side speech recognition helper if supported
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";
          transcriptAccumulatorRef.current = "";
          recognition.onresult = (event) => {
            let current = "";
            for (let i = 0; i < event.results.length; i++) {
              current += event.results[i][0].transcript + " ";
            }
            transcriptAccumulatorRef.current = current;
          };
          recognition.onerror = (e) => {
            console.warn("[VoiceAnalyzer] Browser speech recognition notice:", e.error);
          };
          recognition.start();
          speechRecognitionRef.current = recognition;
        } catch (e) {
          console.warn("[VoiceAnalyzer] Speech recognition initialization notice:", e.message);
        }
      }

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
      toast.error("Microphone access is required for voice analysis. Please check your browser permissions.");
    }
  };

  const stopRecording = async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    clearInterval(timerRef.current);
    cancelAnimationFrame(animationRef.current);
    setIsRecording(false);
    setIsAnalyzing(true);

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore
      }
    }

    return new Promise((resolve) => {
      mediaRecorderRef.current.onstop = async () => {
        stopStream();

        try {
          const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
          const audioFile = new File([audioBlob], "voice-recording.webm", { type: "audio/webm" });

          const avgEnergy = audioData.length > 0 ? audioData.reduce((a, b) => a + b, 0) / audioData.length : 50;
          const pitch = Math.round(avgEnergy * 3 + 80);
          const energy = Math.round(avgEnergy);
          const tempo = Math.round(60 + (avgEnergy / 255) * 80);

          setAnalyzingStep("Processing voice audio...");

          const formData = new FormData();
          formData.append("audio", audioFile);
          const browserTranscript = transcriptAccumulatorRef.current.trim();
          if (browserTranscript) {
            formData.append("transcript", browserTranscript);
          }
          formData.append("pitch", String(pitch));
          formData.append("energy", String(energy));
          formData.append("tempo", String(tempo));
          formData.append("duration", String(duration));

          setAnalyzingStep("Analyzing emotional tone & acoustic signals...");
          const res = await apiClient.analysis.analyzeVoice(formData);

          if (res && res.analysis) {
            setIsAnalyzing(false);
            setAnalyzingStep("");
            setErrorMessage(null);
            onAnalysisComplete(res.analysis);
            resolve();
          } else {
            throw new Error("No analysis result received from server.");
          }
        } catch (err) {
          console.error("Voice analysis error:", err);
          setIsAnalyzing(false);
          setAnalyzingStep("");

          const errMsg = err?.data?.error?.message || err?.message || "Voice analysis could not be completed.";
          setErrorMessage(errMsg);
          toast.error(errMsg, { duration: 6000 });
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
    <div className="card-wellness p-6 sm:p-8 space-y-6">
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E4EDFC] dark:bg-white/10 text-[#284f88] dark:text-[#a0c2f8] text-xs font-semibold">
          <Volume2 className="w-3.5 h-3.5" />
          <span>Speech Acoustics & Emotion</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-[#182B2A] dark:text-white">
          Voice Emotion Check-in
        </h2>
        <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60 max-w-md mx-auto">
          Speak for 1 to 5 minutes about how you're feeling today — your tone, pitch, and cadence guide the reflection.
        </p>
      </div>

      {/* Waveform Visualizer or Mic Sphere */}
      <div className="relative h-44 flex items-center justify-center rounded-3xl bg-[#F7F5F0] dark:bg-black/20 border border-[#E9EAE7] dark:border-white/10 overflow-hidden">
        <AnimatePresence mode="wait">
          {isRecording ? (
            <motion.div
              key="recording"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-1.5 h-28 px-4"
            >
              {audioData.map((value, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 sm:w-2 bg-gradient-to-t from-[#245746] to-[#88c5ad] rounded-full"
                  animate={{ height: Math.max(6, Math.min(100, value * 0.9)) }}
                  transition={{ duration: 0.05 }}
                />
              ))}
            </motion.div>
          ) : isAnalyzing ? (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 text-center p-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#E4EDFC] text-[#284f88] flex items-center justify-center animate-pulse">
                <Volume2 className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-[#182B2A] dark:text-white">
                  {analyzingStep || "Analyzing voice acoustics..."}
                </p>
                <p className="text-[11px] text-[#697681] dark:text-white/50 mt-0.5">
                  Interpreting pitch, cadence, and vocal energy
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative flex flex-col items-center justify-center"
            >
              <div className="w-20 h-20 rounded-3xl bg-[#E4EDFC] dark:bg-white/10 text-[#284f88] dark:text-[#a0c2f8] flex items-center justify-center shadow-xs">
                <Mic className="w-9 h-9 stroke-[1.8px]" />
              </div>
              <p className="text-xs font-semibold text-[#182B2A] dark:text-white mt-3">Ready to record</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Timer & Duration Progress */}
      {isRecording && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-xl font-mono font-bold text-[#245746] dark:text-[#88c5ad]">
            <Clock className="w-4 h-4" />
            <span>{formatTime(duration)}</span>
            <span className="text-xs text-[#697681] font-normal">/ 5:00 max</span>
          </div>
          <div className="w-full h-2 bg-[#F7F5F0] dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${progress}%` }}
              className="h-full bg-[#245746] dark:bg-[#88c5ad] rounded-full"
            />
          </div>
        </motion.div>
      )}

      {/* Honest Error notice */}
      {errorMessage && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-left text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-100">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Voice Processing Notice</span>
          </div>
          <p className="text-xs leading-relaxed">{errorMessage}</p>
        </div>
      )}

      {/* Recording Actions */}
      <div className="flex justify-center">
        {!isRecording && !isAnalyzing ? (
          <Button
            onClick={startRecording}
            className="h-12 px-8 rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 min-h-[44px]"
          >
            <Mic className="w-4 h-4 mr-2" />
            Start Voice Check-in
          </Button>
        ) : isRecording ? (
          <Button
            onClick={stopRecording}
            variant="destructive"
            className="h-12 px-8 rounded-2xl text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 min-h-[44px]"
          >
            <Square className="w-4 h-4 mr-2 fill-current" />
            Stop & Analyze
          </Button>
        ) : null}
      </div>
    </div>
  );
}