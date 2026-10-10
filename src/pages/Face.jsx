import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowLeft, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import FaceAnalyzer from "@/components/face/FaceAnalyzer";
import MoodCard from "@/components/mood/MoodCard";
import StressIndicator from "@/components/mood/StressIndicator";

export default function Face() {
  const [analysisResult, setAnalysisResult] = useState(null);
  const queryClient = useQueryClient();

  const saveMoodMutation = useMutation({
    mutationFn: (moodData) => base44.entities.MoodEntry.create(moodData),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["moodEntries"] }),
  });

  const handleAnalysisComplete = (analysis) => {
    setAnalysisResult(analysis);

    saveMoodMutation.mutate({
      mood: analysis.dominant_emotion,
      stress_level: analysis.stress_level,
      mood_score: analysis.mood_score || 10 - analysis.stress_level,
      source: "face",
      face_analysis: {
        dominant_emotion: analysis.dominant_emotion,
        confidence: analysis.confidence,
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
            <h1 className="text-2xl font-bold text-slate-800">Face Analysis</h1>
            <p className="text-sm text-slate-500">AI-powered facial emotion detection</p>
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
              <FaceAnalyzer onAnalysisComplete={handleAnalysisComplete} />

              {/* Info */}
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-indigo-50">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-700">How It Works</h3>
                    <p className="mt-2 text-sm text-slate-500 leading-relaxed">
                      Our AI captures your photo and analyzes facial expressions, micro-expressions, and visual cues to understand your emotional state. It considers eye tension, mouth position, eyebrow angle, and overall facial muscle patterns for accurate mood detection.
                    </p>
                  </div>
                </div>
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
                className="rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 p-6 text-white"
                style={{ boxShadow: "0 8px 30px -6px rgba(99,102,241,0.3)" }}
              >
                <p className="text-sm text-white/80 mb-1">Your Emotional Snapshot</p>
                <h2 className="text-4xl font-bold capitalize mb-4">{analysisResult.dominant_emotion}</h2>
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

              {/* Captured Image */}
              {analysisResult.image && (
                <div className="rounded-3xl overflow-hidden border border-slate-100" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                  <img src={analysisResult.image} alt="Captured" className="w-full aspect-video object-cover" />
                </div>
              )}

              {/* Detected Mood */}
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <h3 className="font-semibold text-slate-700 mb-4">Detected Emotion</h3>
                <MoodCard mood={analysisResult.dominant_emotion} source="face" />
              </div>

              {/* Stress Level */}
              <div className="rounded-3xl bg-white border border-slate-100 p-6" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
                <h3 className="font-semibold text-slate-700 mb-4">Stress Assessment</h3>
                <StressIndicator level={analysisResult.stress_level} size="lg" />
              </div>

              {/* Observations */}
              {analysisResult.observations && (
                <div className="rounded-3xl bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-100 p-6">
                  <h3 className="font-semibold text-slate-700 mb-3">What We Noticed</h3>
                  <p className="text-slate-600 leading-relaxed text-sm">{analysisResult.observations}</p>
                </div>
              )}

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