"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, ChevronRight, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

type Step = "request" | "reset" | "done";

export default function ResetPasswordPage() {
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [returnedToken, setReturnedToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Email is required."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (data.resetToken) {
        setReturnedToken(data.resetToken);
        setToken(data.resetToken);
      }
      setStep("reset");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const t = token.trim();
    const pw = newPassword;
    const cpw = confirmPassword;

    if (!t) { setError("Reset token is required."); return; }
    if (pw.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (pw !== cpw) { setError("Passwords don't match."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: t, newPassword: pw }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to reset password."); return; }
      setStep("done");
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mb-3 shadow-lg shadow-violet-500/25">
            <span className="text-white text-xl font-bold">S</span>
          </div>
          <h1 className="text-2xl font-bold text-gradient">SaralOps</h1>
        </div>

        <div className="glass rounded-2xl p-8">
          <Link href="/login" className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to login
          </Link>

          {/* ── Step 1: Request token ── */}
          {step === "request" && (
            <>
              <h2 className="text-lg font-semibold mb-1">Reset your password</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5">
                Enter your email address to get a password reset token.
              </p>
              <form onSubmit={handleRequest} className="space-y-4" noValidate>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Email address</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="rahman@saralvidhya.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    autoFocus
                  />
                </div>
                {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center disabled:opacity-50">
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Processing...</>
                    : <>Get reset token <ChevronRight className="w-4 h-4" /></>
                  }
                </button>
              </form>
            </>
          )}

          {/* ── Step 2: Use token + set new password ── */}
          {step === "reset" && (
            <>
              <h2 className="text-lg font-semibold mb-1">Set new password</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">
                Your reset token is shown below — it's already filled in for you.
              </p>

              {returnedToken && (
                <div className="mb-4 p-3 rounded-xl bg-[hsl(var(--primary))]/10 border border-[hsl(var(--primary))]/20 text-xs">
                  <p className="text-[hsl(var(--muted-foreground))] mb-1 font-medium">Reset token (auto-filled):</p>
                  <code className="text-[hsl(var(--primary))] font-mono break-all text-[10px]">{returnedToken}</code>
                  <p className="text-[hsl(var(--muted-foreground))] mt-1">⏱ Expires in 1 hour</p>
                </div>
              )}

              <form onSubmit={handleReset} className="space-y-4" noValidate>
                <div>
                  <label className="block text-xs font-medium mb-1.5">Reset token</label>
                  <input
                    type="text"
                    className="input-field font-mono text-xs"
                    placeholder="Paste token here if not auto-filled"
                    value={token}
                    onChange={(e) => { setToken(e.target.value); setError(""); }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">New password <span className="text-[hsl(var(--muted-foreground))]">(min 8 chars)</span></label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      className="input-field pr-10"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword.length > 0 && newPassword.length < 8 && (
                    <p className="text-[10px] text-amber-400 mt-1">{8 - newPassword.length} more characters needed</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? "text" : "password"}
                      className="input-field pr-10"
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw(!showConfirmPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                    >
                      {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-[10px] text-amber-400 mt-1">Passwords don't match yet</p>
                  )}
                </div>

                {error && <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{error}</p>}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Resetting...</>
                    : "Set new password"
                  }
                </button>
              </form>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === "done" && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h2 className="text-lg font-semibold mb-2">Password updated!</h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-5">
                Your password has been successfully reset. You can now log in.
              </p>
              <Link href="/login" className="btn-primary justify-center">
                Go to login
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
