"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
    const supabase = createClient();
    const router = useRouter();
    const [user, setUser] = useState<{ email: string } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function getUser() {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user ? { email: user.email ?? 'User' } : null);
            setLoading(false);
        }
        getUser();
    }, [supabase]);

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/sign-in');
    };

    if (loading) return null;
    if (!user) return null;

    return (
        <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <button
                onClick={handleSignOut}
                className="text-sm text-muted-foreground hover:text-foreground underline"
            >
                Sign out
            </button>
        </div>
    );
}
