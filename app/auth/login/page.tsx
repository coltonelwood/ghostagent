"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (authError) {
      setError("Something went wrong. Please try again.");
    } else {
      setSent(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#07070c] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-8">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-lg shadow-violet-900/40">
              <span className="text-sm font-bold text-white">N</span>
            </div>
            <span className="text-lg font-semibold text-white">Nexus</span>
          </Link>
          {!sent && (
            <>
              <h1 className="text-2xl font-bold text-white mt-6">Sign in to Nexus</h1>
              <p className="mt-2 text-sm text-white/40">
                Enter your work email. We'll send you a secure sign-in link.
              </p>
            </>
          )}
        </div>

        {sent ? (
          /* Success state */
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center">
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <svg className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-white">Check your email</h2>
            <p className="mt-2 text-sm text-white/40 leading-relaxed">
              We sent a sign-in link to <span className="text-white/70">{email}</span>.<br />
              Click the link to continue.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="mt-6 text-sm text-white/30 hover:text-white/60 transition-colors"
            >
              Use a different email
            </button>
          </div>
        ) : (
          /* Login form */
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-white/70 mb-2">
                  Work email
                </label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full h-11 rounded-xl border border-white/[0.08] bg-white/[0.05] px-4 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/30 transition-all"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors shadow-lg shadow-violet-900/30"
              >
                {loading ? "Sending link…" : "Send sign-in link →"}
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-white/20">
              By signing in, you agree to our terms of service.
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-white/25">
          New to Nexus?{" "}
          <Link href="/" className="text-white/50 hover:text-white transition-colors">
            Learn more →
          </Link>
        </p>
      </div>
    </div>
  );
}
