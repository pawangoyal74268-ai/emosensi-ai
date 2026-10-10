import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Moon, Sun, Sparkles, ShieldCheck, Bell, Globe, HelpCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { createPageUrl } from "@/utils";

export default function Settings() {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") !== "light";
  });

  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/50 via-white to-purple-50/30">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to={createPageUrl("Home")}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="p-2.5 rounded-2xl bg-white border border-slate-100 text-slate-500 hover:text-violet-600"
              style={{ boxShadow: "0 2px 8px -2px rgba(124,58,237,0.06)" }}
            >
              <ArrowLeft className="w-5 h-5" />
            </motion.button>
          </Link>
          <h1 className="text-2xl font-bold text-slate-800">Settings</h1>
        </div>

        {/* Appearance */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">Appearance</p>
          <div className="rounded-3xl bg-white border border-slate-100 p-5 space-y-1" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-violet-50">
                  {darkMode ? (
                    <Moon className="w-5 h-5 text-violet-500" />
                  ) : (
                    <Sun className="w-5 h-5 text-amber-500" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-slate-700">Dark Mode</p>
                  <p className="text-sm text-slate-400">
                    {darkMode ? 'Dark theme enabled' : 'Light theme enabled'}
                  </p>
                </div>
              </div>
              <Switch checked={darkMode} onCheckedChange={setDarkMode} />
            </div>
          </div>
        </motion.div>

        {/* About */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">About</p>
          <div className="rounded-3xl bg-white border border-slate-100 p-5" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600" style={{ boxShadow: "0 4px 12px -2px rgba(124,58,237,0.25)" }}>
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-slate-700">EmoSense AI</p>
                <p className="text-sm text-slate-400">Version 1.0.0</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 leading-relaxed">
                Powered by advanced AI for mood detection, stress analysis, and emotional wellness support.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Privacy */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">Privacy</p>
          <div className="rounded-3xl bg-white border border-slate-100 p-5" style={{ boxShadow: "0 2px 20px -5px rgba(124,58,237,0.06)" }}>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-emerald-50">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium text-slate-700">Your data is private</p>
                <p className="text-sm text-slate-400 mt-1 leading-relaxed">
                  Camera access is only used during Face Scan. Microphone access is only used during voice analysis. Your emotional data is securely stored and never shared.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}