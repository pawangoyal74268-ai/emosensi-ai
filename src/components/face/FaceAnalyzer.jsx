import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RefreshCw, Scan, X, Upload, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";

export default function FaceAnalyzer({ onAnalysisComplete }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [uploadedUrl, setUploadedUrl] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const startCamera = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please allow camera permissions in your browser settings and try again.");
    }
  };

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !videoRef.current.videoWidth) {
      setError("Camera not ready yet. Please wait a moment and try again.");
      return;
    }

    setIsCapturing(true);

    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0);

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setCapturedImage(imageDataUrl);
    stopCamera();
    setIsCapturing(false);
    setIsAnalyzing(true);

    try {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const imageFile = new File([blob], "face-capture.jpg", { type: "image/jpeg" });

      const uploadRes = await base44.integrations.Core.UploadFile({ file: imageFile });
      const imageUrl = uploadRes.file_url;
      setUploadedUrl(imageUrl);

      const aiResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert emotion detection AI. Analyze this facial image carefully. Look at the person's facial expressions, micro-expressions, eye tension, mouth position, eyebrow position, and overall muscle patterns. Determine the dominant emotion, stress level, and confidence. Be accurate and empathetic.`,
        file_urls: [imageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            dominant_emotion: {
              type: "string",
              enum: ["happy", "calm", "neutral", "anxious", "sad", "stressed", "angry"],
            },
            confidence: { type: "number", description: "Confidence percentage 0-100" },
            stress_level: { type: "number", description: "Stress level 1-10" },
            mood_score: { type: "number", description: "Mood score 1-10 (10 = very positive)" },
            observations: { type: "string", description: "Detailed supportive observations about facial cues detected" },
          },
        },
      });

      onAnalysisComplete({
        ...aiResponse,
        image: imageDataUrl,
        uploadedImageUrl: imageUrl,
      });
    } catch (err) {
      console.error("Face analysis error:", err);
      onAnalysisComplete({
        dominant_emotion: "neutral",
        confidence: 50,
        stress_level: 5,
        mood_score: 5,
        observations: "Unable to complete full analysis. Please ensure good lighting and face the camera directly, then try again.",
        image: imageDataUrl,
        uploadedImageUrl: null,
      });
    }

    setIsAnalyzing(false);
  };

  const reset = () => {
    setCapturedImage(null);
    setUploadedUrl(null);
    setError(null);
  };

  return (
    <div className="rounded-3xl bg-white border border-slate-100 p-8" style={{ boxShadow: "0 4px 30px -8px rgba(124,58,237,0.08)" }}>
      <div className="text-center space-y-6">
        <div className="space-y-1.5">
          <h3 className="text-xl font-semibold text-slate-800">Face Emotion Scan</h3>
          <p className="text-sm text-slate-400">
            Our AI will analyze your facial expressions to detect your mood
          </p>
        </div>

        {/* Camera / Preview Area */}
        <div className="relative aspect-video max-w-md mx-auto rounded-3xl overflow-hidden bg-slate-50">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full object-cover absolute inset-0 transition-opacity",
              cameraActive ? "opacity-100" : "opacity-0"
            )}
          />

          <AnimatePresence mode="wait">
            {cameraActive && (
              <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none"
              >
                <div className="absolute inset-8 border-2 border-violet-400/40 rounded-2xl" />
                <motion.div
                  animate={{ top: ["10%", "80%", "10%"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute left-8 right-8 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {cameraActive && (
            <button
              onClick={stopCamera}
              className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur rounded-full text-slate-500 hover:bg-white transition-colors z-10"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {capturedImage && !cameraActive && (
            <motion.div
              key="captured"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute inset-0"
            >
              <img src={capturedImage} alt="Captured" className="w-full h-full object-cover" />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
                  <div className="relative w-16 h-16">
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.1, 0.3] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-violet-300"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Scan className="w-8 h-8 text-violet-600" />
                    </div>
                  </div>
                  <p className="text-slate-600 text-sm font-medium">AI scanning your face...</p>
                </div>
              )}
            </motion.div>
          )}

          {!cameraActive && !capturedImage && (
            <motion.div
              key="placeholder"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-violet-50 to-purple-50"
            >
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-white flex items-center justify-center" style={{ boxShadow: "0 4px 16px -4px rgba(124,58,237,0.1)" }}>
                  <Camera className="w-10 h-10 text-violet-400" />
                </div>
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className="absolute inset-0 rounded-full border-2 border-violet-300"
                />
              </div>
              <p className="mt-4 text-slate-400 text-sm">Camera not active</p>
            </motion.div>
          )}
        </div>

        {/* Error */}
        {error && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-rose-500 text-sm">
            {error}
          </motion.p>
        )}

        {/* Uploaded image preview */}
        {uploadedUrl && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center gap-3"
          >
            <Upload className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-xs text-slate-500">Uploaded image:</p>
              <p className="text-xs text-emerald-600 truncate font-mono">{uploadedUrl}</p>
            </div>
            <a href={uploadedUrl} target="_blank" rel="noopener noreferrer" className="p-2 rounded-xl bg-white text-slate-400 hover:text-violet-600 transition-colors flex-shrink-0">
              <ExternalLink className="w-4 h-4" />
            </a>
          </motion.div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-3">
          {!cameraActive && !capturedImage ? (
            <Button
              onClick={startCamera}
              size="lg"
              className="rounded-full px-8 h-12 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 border-0"
              style={{ boxShadow: "0 4px 16px -2px rgba(99,102,241,0.3)" }}
            >
              <Camera className="w-5 h-5 mr-2" />
              Start Camera
            </Button>
          ) : cameraActive ? (
            <Button
              onClick={captureAndAnalyze}
              disabled={isCapturing}
              size="lg"
              className="rounded-full px-8 h-12 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 border-0"
              style={{ boxShadow: "0 4px 16px -2px rgba(124,58,237,0.3)" }}
            >
              <Scan className="w-5 h-5 mr-2" />
              {isCapturing ? "Capturing..." : "Scan My Face"}
            </Button>
          ) : capturedImage && !isAnalyzing ? (
            <Button onClick={reset} size="lg" variant="outline" className="rounded-full px-8 h-12 border-slate-200 text-slate-600 hover:bg-slate-50">
              <RefreshCw className="w-5 h-5 mr-2" />
              Try Again
            </Button>
          ) : null}
        </div>

        {/* Privacy */}
        <div className="flex items-center justify-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-300" />
          <p className="text-xs text-slate-400">Camera access is only used when you choose Face Scan</p>
        </div>
      </div>
    </div>
  );
}