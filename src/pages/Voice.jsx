import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, Volume2, Activity, Gauge, RefreshCw, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import VoiceAnalyzer from "@/components/voice/VoiceAnalyzer";
import MoodCard from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";

export default function Voice() {
  const [analysisResult, setAnalysisResult] = useState(null);
  const queryClient = useQueryClient();

  const saveMoodMutation = useMutation({
    mutationFn: (moodData) => base44.entities.MoodEntry.create(moodData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["moodEntries"] }),
  });

  const handleAnalysisComplete = (analysis) => {
    setAnalysisResult(analysis);

    saveMoodMutation.mutate({
      mood: analysis.detected_mood,
      stress_level: analysis.stress_level,
      mood_score: analysis.mood_score || 10 - analysis.stress_level,
      source: "voice",
      notes: analysis.transcript || "",
      voice_analysis: {
        pitch: analysis.pitch,
        energy: analysis.energy,
        tempo: analysis.tempo,
      },
    });
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/50 via-white to-purple-50/30">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Home")}>
            <Button variant="ghost" size="icon" className="rounded-full bg-white border border-slate-100 text-slate-500 hover:text-violet-600" style={{ boxShadow: "0 2px 8px -2px rgba(124,58,237,0.06)" }}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Voice Analysis</h1>
            <p className="text-sm text-slate-500">5-minute daily mood check-in with AI</p>
          </div>
        </div>

        {/* Analyzer or Results */}
        <AnimatePresence mode="wait">
          {!analysisResult ? (
            <motion.div
              key="analyzer"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-5"
            >
              <VoiceAnalyzer onAnalysisComplete={handleAnalysisComplete} />

              {/* Tips */}
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <h3 className="font-semibold text-slate-700 mb-4">Tips for Best Results</h3>
                <ul className="space-y-3 text-sm text-slate-500">
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">1</span>
                    <span>Speak naturally about how you're feeling today — your words matter</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">2</span>
                    <span>Record for at least 1-2 minutes for accurate analysis (up to 5 min)</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-xl bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-semibold flex-shrink-0">3</span>
                    <span>Find a quiet environment for better voice detection</span>
                  </li>
                </ul>
              </div>

              {/* Privacy */}
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-slate-300" />
                <p className="text-xs text-slate-400">Microphone access is only used during voice analysis</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              className="space-y-5"
            >
              {/* Your Emotional Snapshot */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl bg-gradient-to-br from-violet-500 to-purple-600 p-6 text-white"
                style={{ boxShadow: "0 8px 30px -6px rgba(124,58,237,0.3)" }}
              >
                <p className="text-sm text-white/80 mb-1">Your Emotional Snapshot</p>
                <h2 className="text-4xl font-bold capitalize mb-4">{analysisResult.detected_mood}</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-white/70">Stress Level</p>
                    <p className="text-xl font-semibold mt-0.5">
                      {analysisResult.stress_level <= 3 ? "Low" : analysisResult.stress_level <= 5 ? "Moderate" : analysisResult.stress_level <= 7 ? "Elevated" : "High"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/70">Confidence</p>
                    <p className="text-xl font-semibold mt-0.5">{analysisResult.confidence}%</p>
                  </div>
                </div>
              </motion.div>

              {/* Detected Mood */}
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <h3 className="font-semibold text-slate-700 mb-4">Detected Emotion</h3>
                <MoodCard mood={analysisResult.detected_mood} source="voice" />
              </div>

              {/* Transcript */}
              {analysisResult.transcript && (
                <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquare className="w-5 h-5 text-violet-500" />
                    <h3 className="font-semibold text-slate-700">What You Said</h3>
                  </div>
                  <p className="text-slate-500 text-sm leading-relaxed italic">"{analysisResult.transcript}"</p>
                </div>
              )}

              {/* AI Summary */}
              {analysisResult.summary && (
                <div className="rounded-3xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100 p-6">
                  <h3 className="font-semibold text-slate-700 mb-3">AI Summary</h3>
                  <p className="text-slate-600 leading-relaxed text-sm">{analysisResult.summary}</p>
                </div>
              )}

              {/* Stress Level */}
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <h3 className="font-semibold text-slate-700 mb-4">Stress Assessment</h3>
                <StressIndicator level={analysisResult.stress_level} size="lg" />
              </div>

              {/* Voice Metrics */}
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <h3 className="font-semibold text-slate-700 mb-4">Voice Metrics</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-4 rounded-2xl bg-violet-50">
                    <Volume2 className="w-6 h-6 mx-auto text-violet-500 mb-2" />
                    <p className="text-xl font-bold text-slate-700">{Math.round(analysisResult.pitch)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Pitch (Hz)</p>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-rose-50">
                    <Activity className="w-6 h-6 mx-auto text-rose-500 mb-2" />
                    <p className="text-xl font-bold text-slate-700">{Math.round(analysisResult.energy)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Energy</p>
                  </div>
                  <div className="text-center p-4 rounded-2xl bg-teal-50">
                    <Gauge className="w-6 h-6 mx-auto text-teal-500 mb-2" />
                    <p className="text-xl font-bold text-slate-700">{Math.round(analysisResult.tempo)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Tempo (BPM)</p>
                  </div>
                </div>
              </div>

              {/* Confidence & Actions */}
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-400">Analysis Confidence</p>
                    <p className="text-2xl font-bold text-slate-700">{analysisResult.confidence}%</p>
                  </div>
                  <Button onClick={resetAnalysis} variant="outline" className="rounded-full border-slate-200 text-slate-600 hover:bg-slate-50">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Analyze Again
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}