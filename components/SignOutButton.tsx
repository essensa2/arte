"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<{ email: string; name?: string } | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setUser(null);
      } else {
        const name =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined);
        setUser({ email: user.email ?? "User", name });
      }
      setLoading(false);
    }
    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user;
      if (!next) {
        setUser(null);
        return;
      }
      const name =
        (next.user_metadata?.full_name as string | undefined) ||
        (next.user_metadata?.name as string | undefined);
      setUser({ email: next.email ?? "User", name });
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/sign-in");
  };

  if (loading || !user) return null;

  const label = user.name?.trim() || user.email;

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/profile"
        className="max-w-[14rem] truncate text-sm text-muted-foreground underline hover:text-foreground"
        title={user.email}
      >
        {label}
      </Link>
      <button
        onClick={handleSignOut}
        className="text-sm text-muted-foreground underline hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
