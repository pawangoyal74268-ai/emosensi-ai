// EmoSense AI — Authentication Modal Component
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Mail, User, Sparkles, AlertCircle, Loader2 } from "lucide-react";

export default function AuthModal({ isOpen, onClose, onLogin, onRegister, onDemoLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const resetForm = () => {
    setEmail("");
    setPassword("");
    setName("");
    setError(null);
  };

  const handleOpenChange = (open) => {
    if (!open) {
      resetForm();
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isRegister) {
        if (!email || !password) {
          throw new Error("Please enter both email and password.");
        }
        if (password.length < 6) {
          throw new Error("Password must be at least 6 characters.");
        }
        await onRegister(email, password, name);
      } else {
        if (!email || !password) {
          throw new Error("Please enter both email and password.");
        }
        await onLogin(email, password);
      }
      resetForm();
      onClose();
    } catch (err) {
      setError(err?.data?.error?.message || err?.message || "Authentication failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setIsLoading(true);
    try {
      if (onDemoLogin) {
        await onDemoLogin();
        resetForm();
        onClose();
      }
    } catch (err) {
      setError(err?.message || "Demo login failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md p-6 bg-white dark:bg-[#14231f] rounded-3xl border border-[#E9EAE7] dark:border-white/10 shadow-2xl">
        <DialogHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#245746] flex items-center justify-center text-white shadow-sm">
            <Sparkles className="w-6 h-6 text-[#DDE8DF]" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-heading font-bold tracking-tight text-[#182B2A] dark:text-white">
            {isRegister ? "Create EmoSense Account" : "Welcome to EmoSense AI"}
          </DialogTitle>
          <DialogDescription className="text-[#697681] dark:text-white/60 text-xs sm:text-sm">
            {isRegister
              ? "Track your emotional wellness, voice and face sentiment history securely."
              : "Sign in to access your private emotional history and AI companion."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/40 text-rose-700 dark:text-rose-200 text-xs leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          {isRegister && (
            <div className="space-y-1">
              <Label htmlFor="auth-name" className="text-xs font-semibold text-[#182B2A] dark:text-white">
                Your Name (Optional)
              </Label>
              <div className="relative">
                <User className="w-4 h-4 text-[#697681] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <Input
                  id="auth-name"
                  type="text"
                  placeholder="e.g. Alex Morgan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10 h-11 rounded-2xl border-[#E9EAE7] dark:border-white/10 bg-[#F7F5F0]/60 dark:bg-black/20 text-xs sm:text-sm"
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="auth-email" className="text-xs font-semibold text-[#182B2A] dark:text-white">
              Email Address
            </Label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#697681] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                id="auth-email"
                type="email"
                required
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-11 rounded-2xl border-[#E9EAE7] dark:border-white/10 bg-[#F7F5F0]/60 dark:bg-black/20 text-xs sm:text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="auth-password" className="text-xs font-semibold text-[#182B2A] dark:text-white">
              Password
            </Label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#697681] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                id="auth-password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 h-11 rounded-2xl border-[#E9EAE7] dark:border-white/10 bg-[#F7F5F0]/60 dark:bg-black/20 text-xs sm:text-sm"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full h-11 rounded-2xl bg-[#245746] hover:bg-[#1d4839] text-white font-bold text-xs sm:text-sm shadow-xs transition-all min-h-[44px]"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRegister ? "Creating account..." : "Signing in..."}
              </span>
            ) : isRegister ? (
              "Create Account"
            ) : (
              "Sign In"
            )}
          </Button>
        </form>

        <div className="relative my-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E9EAE7] dark:border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white dark:bg-[#14231f] px-3 text-[#697681] text-[10px] font-semibold tracking-wider">or</span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={handleDemo}
          disabled={isLoading}
          className="w-full h-11 rounded-2xl border-[#E9EAE7] dark:border-white/10 bg-[#DDE8DF]/40 dark:bg-white/5 text-[#245746] dark:text-[#88c5ad] hover:bg-[#DDE8DF]/70 font-semibold text-xs min-h-[44px]"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Quick Demo Login (Instant Access)
        </Button>

        <div className="text-center pt-1">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-xs font-semibold text-[#245746] dark:text-[#88c5ad] hover:underline"
          >
            {isRegister
              ? "Already have an account? Sign in"
              : "Don't have an account yet? Create one"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
