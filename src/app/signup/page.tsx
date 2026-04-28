"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, CheckCircle2, ArrowLeft, UserPlus } from "lucide-react";
import Link from "next/link";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ status: "active" | "pending"; message: string } | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Signup failed. Please try again.");
        return;
      }

      setSuccess({ status: data.status, message: data.message });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isInternalDomain = email.endsWith("@saralvidhya.com") || email.endsWith("@sarallabs.com");

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-8">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/25">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-3xl font-bold text-gradient">SaralOps</h1>
          <p className="mt-2 text-[hsl(var(--muted-foreground))] text-sm text-center">
            Create your account
          </p>
        </div>

        <div className="glass rounded-2xl p-8">
          <Link href="/login" className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] mb-5 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to login
          </Link>

          {/* ── Success state ── */}
          {success ? (
            <div className="text-center py-4">
              <CheckCircle2 className={`w-14 h-14 mx-auto mb-4 ${success.status === "active" ? "text-emerald-400" : "text-amber-400"}`} />
              <h2 className="text-lg font-semibold mb-2">
                {success.status === "active" ? "Account created! 🎉" : "Request submitted!"}
              </h2>
              <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">{success.message}</p>
              {success.status === "active" ? (
                <Link href="/login" className="btn-primary justify-center w-full">
                  Sign in now
                </Link>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-[hsl(var(--muted-foreground))] bg-[hsl(var(--secondary))] rounded-xl p-3">
                    An admin will review your request. You'll be able to sign in once approved.
                  </p>
                  <Link href="/login" className="btn-secondary justify-center w-full block text-center">
                    Back to login
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <>
              <h2 className="text-xl font-semibold mb-1">Create your account</h2>
              <p className="text-[hsl(var(--muted-foreground))] text-sm mb-5">
                {isInternalDomain
                  ? "Your domain gets instant access ✓"
                  : "Other domains require admin approval"}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {/* Name */}
                <div>
                  <label className="block text-xs font-medium mb-1.5">Full name</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Rahman"
                    value={name}
                    onChange={(e) => { setName(e.target.value); setError(""); }}
                    autoFocus
                    autoComplete="name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium mb-1.5">Work email</label>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="you@saralvidhya.com"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(""); }}
                    autoComplete="email"
                  />
                  {email && (
                    <p className={`text-[10px] mt-1 ${isInternalDomain ? "text-emerald-400" : "text-amber-400"}`}>
                      {isInternalDomain ? "✓ Instant access" : "⏳ Requires admin approval"}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium mb-1.5">
                    Password <span className="text-[hsl(var(--muted-foreground))]">(min 8 chars)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      className="input-field pr-10"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setError(""); }}
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
                  {password.length > 0 && password.length < 8 && (
                    <p className="text-[10px] text-amber-400 mt-1">{8 - password.length} more characters needed</p>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-xs font-medium mb-1.5">Confirm password</label>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                    autoComplete="new-password"
                  />
                  {confirmPassword.length > 0 && password !== confirmPassword && (
                    <p className="text-[10px] text-amber-400 mt-1">Passwords don't match yet</p>
                  )}
                  {confirmPassword.length > 0 && password === confirmPassword && password.length >= 8 && (
                    <p className="text-[10px] text-emerald-400 mt-1">✓ Passwords match</p>
                  )}
                </div>

                {error && (
                  <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center disabled:opacity-50"
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account...</>
                    : <><UserPlus className="w-4 h-4" />Create account</>
                  }
                </button>
              </form>

              <p className="text-xs text-[hsl(var(--muted-foreground))] text-center mt-5">
                Already have an account?{" "}
                <Link href="/login" className="text-[hsl(var(--primary))] hover:underline">
                  Sign in
                </Link>
              </p>
            </>
          )}
        </div>

        {/* Domain hint */}
        <p className="text-xs text-center text-[hsl(var(--muted-foreground))] mt-4">
          <span className="text-[hsl(var(--primary))]">@saralvidhya.com</span> and{" "}
          <span className="text-[hsl(var(--primary))]">@sarallabs.com</span>{" "}
          get instant access. Others are reviewed by admins.
        </p>
      </div>
    </div>
  );
}
