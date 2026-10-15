import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, RefreshCw, Scan, X, ShieldCheck, AlertCircle, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import apiClient from "@/api/apiClient";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function FaceAnalyzer({ onAnalysisComplete }) {
  const { isAuthenticated, openAuthModal } = useAuth();
  const [cameraActive, setCameraActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [error, setError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (cameraActive && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraActive]);

  const startCamera = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to perform a face emotion scan.");
      openAuthModal();
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Unable to access camera. Please allow camera permissions in your browser or use the Upload Photo option below.");
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

  const processAndSubmit = async (imageFile, previewUrl) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", imageFile);

      const res = await apiClient.analysis.analyzeFace(formData);

      if (res && res.analysis) {
        setIsAnalyzing(false);
        onAnalysisComplete({
          ...res.analysis,
          image: previewUrl, // In-memory session preview only
        });
      } else {
        throw new Error("No analysis result received from server.");
      }
    } catch (err) {
      console.error("Face analysis error:", err);
      setIsAnalyzing(false);
      const errorMessage =
        err?.data?.error?.message ||
        err?.message ||
        "Face analysis could not be completed.";
      setError(errorMessage);
      toast.error(errorMessage, { duration: 6000 });
      // Honest reporting: do NOT fabricate fake results on failure
    }
  };

  const captureAndAnalyze = async () => {
    if (!isAuthenticated) {
      toast.error("Please sign in to perform a face emotion scan.");
      openAuthModal();
      return;
    }

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

    const imageDataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(imageDataUrl);
    stopCamera();
    setIsCapturing(false);

    try {
      const response = await fetch(imageDataUrl);
      const blob = await response.blob();
      const imageFile = new File([blob], "face-capture.jpg", { type: "image/jpeg" });
      await processAndSubmit(imageFile, imageDataUrl);
    } catch (err) {
      console.error("Error creating image blob:", err);
      setIsAnalyzing(false);
      setError("Failed to process captured image.");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAuthenticated) {
      toast.error("Please sign in to upload a photo for analysis.");
      openAuthModal();
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file (JPEG, PNG, or WebP).");
      return;
    }

    stopCamera();
    const previewUrl = URL.createObjectURL(file);
    setCapturedImage(previewUrl);
    await processAndSubmit(file, previewUrl);
  };

  const reset = () => {
    setCapturedImage(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="card-wellness p-6 sm:p-8 space-y-6">
      <div className="text-center space-y-1.5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#DDE8DF] dark:bg-white/10 text-[#245746] dark:text-[#88c5ad] text-xs font-semibold">
          <Camera className="w-3.5 h-3.5" />
          <span>Vision Emotion AI</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-heading font-bold text-[#182B2A] dark:text-white">
          Face Emotion Scan
        </h2>
        <p className="text-xs sm:text-sm text-[#697681] dark:text-white/60 max-w-md mx-auto">
          Reflect on visible facial expressions, eyebrow relaxation, and emotional tone in real-time.
        </p>
      </div>

      {/* Camera / Preview Area */}
      <div className="relative aspect-video max-w-md mx-auto rounded-3xl overflow-hidden bg-[#F7F5F0] dark:bg-black/30 border border-[#E9EAE7] dark:border-white/10">
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

        {/* Viewfinder guideline overlay */}
        <AnimatePresence mode="wait">
          {cameraActive && (
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 pointer-events-none flex items-center justify-center"
            >
              <div className="w-48 h-56 sm:w-56 sm:h-64 border-2 border-[#245746]/50 dark:border-[#88c5ad]/60 rounded-3xl relative">
                {/* Subtle scanning beam */}
                <motion.div
                  animate={{ top: ["5%", "90%", "5%"] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-[#245746] dark:via-[#88c5ad] to-transparent"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {cameraActive && (
          <button
            onClick={stopCamera}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 dark:bg-black/60 backdrop-blur-sm text-[#182B2A] dark:text-white flex items-center justify-center hover:bg-white transition-colors z-10"
            aria-label="Close Camera"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {capturedImage && !cameraActive && (
          <motion.div
            key="captured"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0"
          >
            <img src={capturedImage} alt="Captured face" className="w-full h-full object-cover" />
            {isAnalyzing && (
              <div className="absolute inset-0 bg-[#182B2A]/60 backdrop-blur-xs flex flex-col items-center justify-center gap-3 text-white">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center animate-spin">
                  <Scan className="w-6 h-6 text-white" />
                </div>
                <p className="text-xs sm:text-sm font-semibold tracking-wide">
                  Analyzing facial expressions with vision AI...
                </p>
              </div>
            )}
          </motion.div>
        )}

        {!cameraActive && !capturedImage && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F7F5F0]/80 dark:bg-[#152420]/80 p-6 text-center space-y-3">
            <div className="w-16 h-16 rounded-3xl bg-[#DDE8DF] dark:bg-white/10 text-[#245746] dark:text-[#88c5ad] flex items-center justify-center shadow-xs">
              <Camera className="w-8 h-8 stroke-[1.8px]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[#182B2A] dark:text-white">Camera not active</p>
              <p className="text-[11px] text-[#697681] dark:text-white/50 mt-0.5">
                Start your camera or select an image file to analyze
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Error notice if occurred */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 text-left text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-1">
          <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-100">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>Face Analysis Notice</span>
          </div>
          <p className="text-xs leading-relaxed">{error}</p>
        </div>
      )}

      {/* Controls: Start Camera, Scan My Face, Retake, and Upload controls */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {!cameraActive && !capturedImage ? (
          <>
            <Button
              onClick={startCamera}
              className="h-12 px-6 rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-95 min-h-[44px]"
            >
              <Camera className="w-4 h-4 mr-2" />
              Start Camera
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="h-12 px-5 rounded-2xl border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white hover:bg-[#F7F5F0] dark:hover:bg-white/10 text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo
            </Button>
          </>
        ) : cameraActive ? (
          <Button
            onClick={captureAndAnalyze}
            disabled={isCapturing}
            className="h-12 px-8 rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white text-xs sm:text-sm font-bold shadow-sm transition-all active:scale-95 min-h-[44px]"
          >
            <Scan className="w-4 h-4 mr-2" />
            {isCapturing ? "Capturing..." : "Scan My Face"}
          </Button>
        ) : capturedImage && !isAnalyzing ? (
          <>
            <Button
              onClick={reset}
              variant="outline"
              className="h-12 px-6 rounded-2xl border-[#E9EAE7] dark:border-white/10 text-[#182B2A] dark:text-white hover:bg-[#F7F5F0] dark:hover:bg-white/10 text-xs sm:text-sm font-semibold min-h-[44px]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retake / Try Again
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              className="h-12 px-4 rounded-2xl text-[#697681] dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5 text-xs font-medium"
            >
              Upload Different Photo
            </Button>
          </>
        ) : null}
      </div>

      {/* Privacy Notice */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#697681] dark:text-white/50 text-center">
        <ShieldCheck className="w-4 h-4 text-[#245746] dark:text-[#88c5ad]" />
        <span>In-memory processing only: images are never saved to disk or permanently retained.</span>
      </div>
    </div>
  );
}