"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ProfilePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (error || !user) {
        window.location.assign("/sign-in");
        return;
      }
      setEmail(user.email ?? "");
      setFullName(
        (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          ""
      );
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  async function onSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Not signed in");

      const updates: { email?: string; data?: { full_name: string } } = {
        data: { full_name: fullName.trim() },
      };
      const nextEmail = email.trim();
      if (nextEmail && nextEmail !== user.email) {
        updates.email = nextEmail;
      }

      const { error } = await supabase.auth.updateUser(updates);
      if (error) throw error;

      if (updates.email) {
        toast.success(
          "Profile saved. Check your inbox to confirm the new email if required."
        );
      } else {
        toast.success("Profile saved");
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update profile";
      setProfileError(message);
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Not signed in");

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        throw new Error("Current password is incorrect");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update password";
      setPasswordError(message);
      toast.error(message);
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-md p-6">
        <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
        <div className="mt-6 space-y-3">
          <div className="h-20 animate-pulse rounded-md bg-muted" />
          <div className="h-20 animate-pulse rounded-md bg-muted" />
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Profile</h1>
        <Link
          href="/workspaces"
          className="text-sm text-muted-foreground underline hover:text-foreground"
        >
          Back to workspaces
        </Link>
      </div>

      <section className="rounded-lg border bg-background p-6 shadow-sm">
        <h2 className="text-lg font-medium">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your name and email.
        </p>
        <form onSubmit={onSaveProfile} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Your name"
              autoComplete="name"
            />
          </div>
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
          {profileError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {profileError}
            </p>
          )}
          <Button type="submit" disabled={savingProfile} className="w-full">
            {savingProfile ? "Saving…" : "Save profile"}
          </Button>
        </form>
      </section>

      <section className="mt-6 rounded-lg border bg-background p-6 shadow-sm">
        <h2 className="text-lg font-medium">Password</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter your current password to set a new one.
        </p>
        <form onSubmit={onChangePassword} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Current password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              New password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Confirm new password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              autoComplete="new-password"
            />
          </div>
          {passwordError && (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {passwordError}
            </p>
          )}
          <Button type="submit" disabled={savingPassword} className="w-full">
            {savingPassword ? "Updating…" : "Change password"}
          </Button>
        </form>
      </section>
    </main>
  );
}
