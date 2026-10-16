"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo }
      );
      if (err) throw err;
      setSent(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset email"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center p-6">
      <div className="rounded-lg border bg-background p-8 shadow-sm">
        <h1 className="mb-2 text-2xl font-semibold">Reset password</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Enter your account email and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <div className="space-y-4">
            <p className="rounded-md bg-muted p-3 text-sm">
              If an account exists for <strong>{email}</strong>, a reset link
              has been sent. Check your inbox and spam folder.
            </p>
            <Link
              href="/sign-in"
              className="block text-center text-sm text-muted-foreground underline hover:text-foreground"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
            {error && (
              <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Sending…" : "Send reset link"}
            </Button>
            <Link
              href="/sign-in"
              className="block text-center text-sm text-muted-foreground underline hover:text-foreground"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
