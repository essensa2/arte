"use client";
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';

type Board = {
  id: string;
  name: string;
  created_at: string;
};

export default function BoardsPage() {
  const supabase = createClient();
  const params = useParams<{ workspaceId: string }>();
  const [boards, setBoards] = useState<Board[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('boards')
        .select('*')
        .eq('workspace_id', params.workspaceId)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        if (error) setError(error.message);
        else setBoards(data ?? []);
        setLoading(false);
      }
    }
    if (params.workspaceId) load();
    return () => {
      cancelled = true;
    };
  }, [supabase, params.workspaceId]);

  async function onCreateBoard(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from('boards')
      .insert({ name, workspace_id: params.workspaceId })
      .select('*')
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setBoards((prev) => [...prev, data]);
    setName('');
  }

  async function onStartEdit(id: string, current: string) {
    setEditingId(id);
    setEditingName(current);
  }

  async function onSaveEdit(id: string) {
    const trimmed = editingName.trim();
    if (!trimmed) return;
    const { data, error } = await supabase.from('boards').update({ name: trimmed }).eq('id', id).select('*').single();
    if (error) {
      setError(error.message);
      return;
    }
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name: data.name } : b)));
    setEditingId(null);
    setEditingName('');
  }

  async function onDelete(id: string) {
    if (!confirm('Delete this board? This cannot be undone.')) return;
    const { error } = await supabase.from('boards').delete().eq('id', id);
    if (error) {
      setError(error.message);
      return;
    }
    setBoards((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Boards</h1>
      <form onSubmit={onCreateBoard} className="mt-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium">Board name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product Roadmap"
            className="mt-1 w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <Button variant="primary" type="submit">
          Create
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <section className="mt-8">
        {loading ? (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-md bg-muted"></div>
            <div className="h-20 animate-pulse rounded-md bg-muted"></div>
          </div>
        ) : boards.length ? (
          <ul className="divide-y rounded-md border">
            {boards.map((b) => (
              <li key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {editingId === b.id ? (
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full rounded-md border px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') onSaveEdit(b.id);
                          if (e.key === 'Escape') {
                            setEditingId(null);
                            setEditingName('');
                          }
                        }}
                      />
                    ) : (
                      b.name
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  {editingId === b.id ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSaveEdit(b.id)}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditingId(null);
                          setEditingName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <a
                        href={`/w/${params.workspaceId}/b/${b.id}`}
                        className="rounded-md border px-3 py-1 text-sm hover:bg-muted transition-colors"
                      >
                        Open
                      </a>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onStartEdit(b.id, b.name)}
                      >
                        Rename
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => onDelete(b.id)}
                      >
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No boards yet"
            description="Create your first board to start organizing your items and columns."
          />
        )}
      </section>
    </main>
  );
}


