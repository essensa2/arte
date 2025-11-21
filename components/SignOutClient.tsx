"use client";
import { createClient } from '@/lib/supabase/client';
import { useCallback, useState } from 'react';

export function SignOutClient() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const onSignOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      window.location.assign('/sign-in');
    } finally {
      setLoading(false);
    }
  }, [supabase]);
  return (
    <button
      onClick={onSignOut}
      className="rounded-md border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
      disabled={loading}
      aria-disabled={loading}
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}


