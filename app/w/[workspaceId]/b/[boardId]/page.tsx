"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BoardTable } from '@/components/board/BoardTable';
import { AutomationsModal } from '@/components/automations/AutomationsModal';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { BoardChatbot } from '@/components/chat/Chatbot';

type Board = { id: string; name: string };

export default function BoardPage() {
  const params = useParams<{ workspaceId: string; boardId: string }>();
  const supabase = createClient();
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAutomationsModal, setShowAutomationsModal] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('boards')
        .select('id,name')
        .eq('id', params.boardId)
        .single();
      if (!cancelled) {
        if (error) setError(error.message);
        else setBoard(data);
        setLoading(false);
      }
    }
    if (params.boardId) load();
    return () => {
      cancelled = true;
    };
  }, [supabase, params.boardId]);

  if (loading) return <div className="p-6">Loading board...</div>;
  if (error) return <div className="p-6 text-destructive">{error}</div>;

  return (
    <main className="p-6 min-h-screen">
      {board && (
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-semibold">{board.name}</h1>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowAutomationsModal(true)}
                variant="outline"
                size="sm"
              >
                Settings
              </Button>
              <Sheet>
                <SheetTrigger asChild>
                  <Button size="sm" variant="outline">
                    🤖 AI Assistant
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[425px] sm:w-[540px]">
                  <SheetTitle>Board AI Chatbot</SheetTitle>
                  <BoardChatbot boardId={board.id} onClose={() => setShowChatbot(false)} />
                </SheetContent>
              </Sheet>
            </div>
          </div>
          <BoardTable boardId={board.id} workspaceId={params.workspaceId as string} />
        </div>
      )}
      
      {board && (
        <AutomationsModal
          workspaceId={params.workspaceId}
          boardId={params.boardId}
          isOpen={showAutomationsModal}
          onClose={() => setShowAutomationsModal(false)}
        />
      )}
    </main>
  );
}


