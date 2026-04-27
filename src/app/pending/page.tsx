"use client";

import { signOut } from "next-auth/react";
import { Clock, Mail } from "lucide-react";

export default function PendingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))] relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-amber-600/8 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-violet-600/8 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="glass rounded-2xl p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-8 h-8 text-amber-400" />
          </div>

          <h1 className="text-2xl font-bold mb-2">Awaiting Approval</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6 leading-relaxed">
            Your account has been created and is pending admin review. You'll
            receive an email once your access is approved.
          </p>

          <div className="bg-[hsl(var(--secondary))] rounded-xl p-4 mb-6 text-left">
            <div className="flex items-start gap-3">
              <Mail className="w-4 h-4 text-[hsl(var(--primary))] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium mb-1">What happens next?</p>
                <ul className="text-xs text-[hsl(var(--muted-foreground))] space-y-1.5">
                  <li>• An admin will review your account within 1–2 business days</li>
                  <li>• You'll get an email notification once approved</li>
                  <li>• For urgent access, contact your team admin directly</li>
                </ul>
              </div>
            </div>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="btn-secondary w-full justify-center"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
