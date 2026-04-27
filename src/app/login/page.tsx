"use client";

import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";

function LoginContent() {
  const params = useSearchParams();
  const router = useRouter();
  const error = params.get("error");
  const errorMsg =
    error === "suspended"
      ? "Your account has been suspended. Please contact an admin."
      : error
      ? "Invalid email or password."
      : null;

  const [tab, setTab] = useState<"sso" | "credentials">("sso");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [credError, setCredError] = useState("");

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setCredError("");
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setCredError("Invalid email or password.");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] relative overflow-hidden">
      {/* Background glow orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center mb-4 shadow-lg shadow-violet-500/25">
            <span className="text-white text-2xl font-bold">S</span>
          </div>
          <h1 className="text-3xl font-bold text-gradient">SaralOps</h1>
          <p className="mt-2 text-[hsl(var(--muted-foreground))] text-sm text-center">
            Unified workspace for Saral Vidhya &amp; Saral Labs
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-center mb-2">Welcome back</h2>
          <p className="text-[hsl(var(--muted-foreground))] text-sm text-center mb-6">
            Sign in with your organisation account
          </p>

          {/* Tab switcher */}
          <div className="flex bg-[hsl(var(--secondary))] rounded-lg p-1 mb-6">
            <button
              onClick={() => setTab("sso")}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "sso" ? "bg-[hsl(var(--card))] shadow-sm" : "text-[hsl(var(--muted-foreground))]"}`}
            >
              SSO Login
            </button>
            <button
              onClick={() => setTab("credentials")}
              className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === "credentials" ? "bg-[hsl(var(--card))] shadow-sm" : "text-[hsl(var(--muted-foreground))]"}`}
            >
              Email &amp; Password
            </button>
          </div>

          {(errorMsg || credError) && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
              {errorMsg ?? credError}
            </div>
          )}

          {tab === "sso" ? (
            <div className="space-y-3">
              {/* Google */}
              <button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
                  bg-[hsl(var(--secondary))] border border-[hsl(var(--border))]
                  hover:bg-[hsl(var(--secondary))]/80 hover:border-[hsl(var(--primary))]/30
                  text-sm font-medium transition-all duration-200 active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>

              {/* Microsoft */}
              <button
                onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/dashboard" })}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl
                  bg-[hsl(var(--secondary))] border border-[hsl(var(--border))]
                  hover:bg-[hsl(var(--secondary))]/80 hover:border-[hsl(var(--primary))]/30
                  text-sm font-medium transition-all duration-200 active:scale-[0.98]"
              >
                <svg className="w-5 h-5" viewBox="0 0 23 23" fill="none">
                  <rect x="1" y="1" width="10" height="10" fill="#F25022" />
                  <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
                  <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
                  <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
                </svg>
                Continue with Microsoft
              </button>
            </div>
          ) : (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Email address</label>
                <input
                  type="email"
                  className="input-field"
                  placeholder="rahman@saralvidhya.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    className="input-field pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {loading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in...</> : "Sign in"}
              </button>
              <div className="flex items-center justify-between mt-4">
                <Link href="/signup" className="text-xs text-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]/80 transition-colors underline-offset-2 hover:underline">
                  Create an account
                </Link>
                <Link href="/reset-password" className="text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] transition-colors underline-offset-2 hover:underline">
                  Forgot password?
                </Link>
              </div>
            </form>
          )}

          <p className="mt-6 text-xs text-[hsl(var(--muted-foreground))] text-center">
            Accounts with{" "}
            <span className="text-[hsl(var(--primary))]">@saralvidhya.com</span>{" "}
            or{" "}
            <span className="text-[hsl(var(--primary))]">@sarallabs.com</span>{" "}
            get instant access.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
