"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PostgrestError } from '@supabase/supabase-js';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Workspace = {
  id: string;
  name: string;
  created_at: string;
};

export default function WorkspacesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingWorkspaceId, setEditingWorkspaceId] = useState<string | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      // We fetch workspaces via join through RLS visibility
      // Either select from workspaces directly (RLS enforces membership),
      // or query memberships then fetch workspaces.
      const { data, error } = await supabase.from('workspaces').select('*').order('created_at', { ascending: true });
      if (!cancelled) {
        if (error) setError(error.message);
        else setWorkspaces(data ?? []);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const hasAny = useMemo(() => workspaces.length > 0, [workspaces]);

  async function onCreateWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return;

    // Use the database function to create workspace + membership atomically
    const { data: workspaceId, error: rpcErr } = await supabase
      .rpc('create_workspace_with_membership', { workspace_name: name });

    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }

    // Fetch the newly created workspace
    const { data: ws, error: fetchErr } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', workspaceId)
      .single();

    if (fetchErr) {
      setError(fetchErr.message);
      return;
    }

    setWorkspaces((prev) => [...prev, ws]);
    setName('');
    toast.success('Workspace created');
  }

  const startRenameWorkspace = useCallback((w: Workspace) => {
    setEditingWorkspaceId(w.id);
    setEditingWorkspaceName(w.name);
  }, []);

  const saveRenameWorkspace = useCallback(async () => {
    if (!editingWorkspaceId) return;
    const newName = editingWorkspaceName.trim();
    if (!newName) {
      setEditingWorkspaceId(null);
      setEditingWorkspaceName('');
      return;
    }
    const { error } = await supabase
      .from('workspaces')
      .update({ name: newName })
      .eq('id', editingWorkspaceId);
    if (error) {
      toast.error(`Failed to rename: ${error.message}`);
      return;
    }
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === editingWorkspaceId ? { ...w, name: newName } : w))
    );
    setEditingWorkspaceId(null);
    setEditingWorkspaceName('');
    toast.success('Workspace renamed');
  }, [supabase, editingWorkspaceId, editingWorkspaceName, toast]);

  const deleteWorkspace = useCallback(
    async (workspaceId: string, workspaceName: string) => {
      if (!confirm(`Delete workspace "${workspaceName}"? This will delete all boards and data in this workspace. This cannot be undone.`)) {
        return;
      }
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
      if (error) {
        toast.error(`Failed to delete: ${error.message}`);
        return;
      }
      setWorkspaces((prev) => prev.filter((w) => w.id !== workspaceId));
      toast.success('Workspace deleted');
    },
    [supabase, toast]
  );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-semibold">Workspaces</h1>
      <form onSubmit={onCreateWorkspace} className="mt-6 flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-sm font-medium">Workspace name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Team"
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
            <div className="h-16 animate-pulse rounded-md bg-muted"></div>
            <div className="h-16 animate-pulse rounded-md bg-muted"></div>
          </div>
        ) : hasAny ? (
          <ul className="divide-y rounded-md border">
            {workspaces.map((w) => {
              const isEditing = editingWorkspaceId === w.id;
              return (
                <li key={w.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        value={editingWorkspaceName}
                        onChange={(e) => setEditingWorkspaceName(e.target.value)}
                        onBlur={saveRenameWorkspace}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRenameWorkspace();
                          if (e.key === 'Escape') {
                            setEditingWorkspaceId(null);
                            setEditingWorkspaceName('');
                          }
                        }}
                        autoFocus
                        className="w-full rounded-md border px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    ) : (
                      <>
                        <div className="font-medium">{w.name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</div>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {!isEditing && (
                      <>
                        <button
                          onClick={() => startRenameWorkspace(w)}
                          className="rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors"
                          title="Rename workspace"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => deleteWorkspace(w.id, w.name)}
                          className="rounded-md border px-2 py-1 text-xs text-destructive hover:bg-destructive/10 transition-colors"
                          title="Delete workspace"
                        >
                          Delete
                        </button>
                      </>
                    )}
                    <a
                      href={`/w/${w.id}/boards`}
                      className="rounded-md border px-3 py-1 text-sm hover:bg-muted transition-colors"
                    >
                      Open
                    </a>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="No workspaces yet"
            description="Create your first workspace to start organizing your boards and automations."
          />
        )}
      </section>
    </main>
  );
}


