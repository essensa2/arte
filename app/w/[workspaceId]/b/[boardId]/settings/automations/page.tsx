"use client";
import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Column = { id: string; name: string; type: string; config?: any };
type Board = { id: string; name: string };
type Group = { id: string; name: string };
type Automation = {
  id: string;
  name: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: any;
  action_type: string;
  action_config: any;
};
type StatusOption = { label: string; color: string };

export default function AutomationsSettingsPage() {
  const params = useParams<{ workspaceId: string; boardId: string }>();
  const supabase = createClient();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [statusColumns, setStatusColumns] = useState<Column[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [triggerStatusColumnId, setTriggerStatusColumnId] = useState('');
  const [triggerTargetStatus, setTriggerTargetStatus] = useState('Done');
  const [action, setAction] = useState<'MOVE_TO_BOARD' | 'MOVE_TO_GROUP' | 'CALL_WEBHOOK' | 'SEND_EMAIL' | 'NOTIFY' | 'CHANGE_STATUS'>('MOVE_TO_GROUP');
  const [destBoardId, setDestBoardId] = useState('');
  const [destGroupId, setDestGroupId] = useState('');
  const [destStatus, setDestStatus] = useState('');
  const [destStatusColumnId, setDestStatusColumnId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookPayload, setWebhookPayload] = useState('{}');
  const [emailWebhookUrl, setEmailWebhookUrl] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('<h2>Task Update</h2>\n<p>Hello,</p>\n<p>Task <strong>{{item.name}}</strong> has been updated.</p>\n<p>Status: <strong>{{status.value}}</strong></p>\n<p>Best regards</p>');
  const [emailAfterStatus, setEmailAfterStatus] = useState('');
  const [emailAfterStatusColumnId, setEmailAfterStatusColumnId] = useState('');
  const [showAllPlaceholders, setShowAllPlaceholders] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const isUserTypingRef = useRef(false);
  const editorInitializedRef = useRef(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Dropdown states
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showStatusValueDropdown, setShowStatusValueDropdown] = useState(false);
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
  const statusValueDropdownRef = useRef<HTMLDivElement>(null);
  const actionDropdownRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [bRes, colsRes, boardsRes, groupsRes, autoRes] = await Promise.all([
        supabase.from('boards').select('id,name').eq('id', params.boardId).single(),
        supabase.from('columns').select('id,name,type,config').eq('board_id', params.boardId),
        supabase.from('boards').select('id,name').eq('workspace_id', params.workspaceId).order('name', { ascending: true }),
        supabase.from('groups').select('id,name').eq('board_id', params.boardId).order('name', { ascending: true }),
        supabase.from('automations').select('*').eq('board_id', params.boardId).order('created_at', { ascending: true })
      ]);
      if (cancelled) return;
      if (bRes.error || colsRes.error || boardsRes.error || groupsRes.error || autoRes.error) {
        setError(bRes.error?.message ?? colsRes.error?.message ?? boardsRes.error?.message ?? groupsRes.error?.message ?? autoRes.error?.message ?? 'Failed to load');
      } else {
        setBoard(bRes.data);
        const allColumns = colsRes.data ?? [];
        setColumns(allColumns);
        setStatusColumns(allColumns.filter((c) => c.type === 'status'));
        setBoards(boardsRes.data ?? []);
        setGroups(groupsRes.data ?? []);
        setAutomations(autoRes.data ?? []);
      }
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase, params.boardId, params.workspaceId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setShowColumnDropdown(false);
      }
      if (statusValueDropdownRef.current && !statusValueDropdownRef.current.contains(event.target as Node)) {
        setShowStatusValueDropdown(false);
      }
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target as Node)) {
        setShowActionDropdown(false);
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setShowGroupDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function onCreateAutomation(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name required');
      return;
    }
    if (!triggerStatusColumnId) {
      setError('Select a status column for trigger');
      return;
    }
    let action_config: any = {};
    if (action === 'MOVE_TO_BOARD') {
      if (!destBoardId) {
        setError('Select destination board');
        return;
      }
      action_config = {
        dest_board_id: destBoardId,
        new_status: destStatus || null,
        status_column_id: destStatusColumnId || null,
        archive_source: true
      };
    } else if (action === 'MOVE_TO_GROUP') {
      if (!destGroupId) {
        setError('Select destination group');
        return;
      }
      action_config = {
        dest_group_id: destGroupId
      };
    } else if (action === 'SEND_EMAIL') {
      if (!emailWebhookUrl) {
        setError('Email webhook URL required');
        return;
      }
      if (!emailTemplate.trim()) {
        setError('Email template required');
        return;
      }
      action_config = {
        email_webhook_url: emailWebhookUrl,
        email_template: emailTemplate,
        after_status: emailAfterStatus || null,
        after_status_column_id: emailAfterStatusColumnId || null
      };
    } else {
      try {
        action_config = { url: webhookUrl, payload: webhookPayload ? JSON.parse(webhookPayload) : null };
      } catch (e: any) {
        setError('Invalid JSON payload');
        return;
      }
      if (!webhookUrl) {
        setError('Webhook URL required');
        return;
      }
    }
    const { data, error } = await supabase
      .from('automations')
      .insert({
        board_id: params.boardId,
        name,
        is_active: isActive,
        trigger_type: 'STATUS_CHANGED',
        trigger_config: { column_id: triggerStatusColumnId, target_status: triggerTargetStatus || null },
        action_type: action,
        action_config
      })
      .select('*')
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setAutomations((prev) => [...prev, data]);
    setName('');
    setDestGroupId('');
    setDestBoardId('');
    setDestStatus('');
    setDestStatusColumnId('');
    setWebhookUrl('');
    setWebhookPayload('{}');
    setEmailWebhookUrl('');
    const defaultTemplate = '<h2>Task Update</h2>\n<p>Hello,</p>\n<p>Task <strong>{{item.name}}</strong> has been updated.</p>\n<p>Status: <strong>{{status.value}}</strong></p>\n<p>Best regards</p>';
    setEmailTemplate(defaultTemplate);
    if (editorRef.current) {
      editorRef.current.innerHTML = defaultTemplate;
      editorInitializedRef.current = true;
    }
    setEmailAfterStatus('');
    setEmailAfterStatusColumnId('');
    setShowAllPlaceholders(false);
  }

  async function toggleActive(a: Automation) {
    const { data, error } = await supabase
      .from('automations')
      .update({ is_active: !a.is_active })
      .eq('id', a.id)
      .select('*')
      .single();
    if (error) {
      setError(error.message);
      return;
    }
    setAutomations((prev) => prev.map((x) => (x.id === a.id ? data : x)));
  }

  async function onDelete(a: Automation) {
    if (!confirm('Delete this automation?')) return;
    const { error } = await supabase.from('automations').delete().eq('id', a.id);
    if (error) {
      setError(error.message);
      return;
    }
    setAutomations((prev) => prev.filter((x) => x.id !== a.id));
  }

  async function runNow() {
    setError(null);
    const res = await fetch('/api/automation/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board_id: params.boardId })
    });
    if (!res.ok) {
      const t = await res.text();
      setError(`Run failed: ${t}`);
    }
  }

  const statusColumnsInDest = useMemo(
    () => statusColumns, // MVP assumes same column ids not shared; require explicit selection for dest
    [statusColumns]
  );

  // Get status options for selected column
  const selectedStatusColumn = useMemo(() => {
    return statusColumns.find(c => c.id === triggerStatusColumnId);
  }, [statusColumns, triggerStatusColumnId]);

  const statusOptions: StatusOption[] = useMemo(() => {
    const defaultOptions = [
      { label: 'Done', color: '#00c875' },
      { label: 'Working on it', color: '#fdab3d' },
      { label: 'Stuck', color: '#e2445c' }
    ];
    const columnOptions = selectedStatusColumn?.config?.status_options || defaultOptions;
    // Add default/empty status option at the beginning
    return [
      { label: '__DEFAULT__', color: '#9ca3af' }, // Special marker for default/empty status
      ...columnOptions
    ];
  }, [selectedStatusColumn]);

  const selectedStatusOption = useMemo(() => {
    if (!triggerTargetStatus || triggerTargetStatus === '__DEFAULT__') {
      return { label: '__DEFAULT__', color: '#9ca3af' };
    }
    return statusOptions.find(opt => opt.label === triggerTargetStatus);
  }, [statusOptions, triggerTargetStatus]);

  const selectedColumn = useMemo(() => {
    return statusColumns.find(c => c.id === triggerStatusColumnId);
  }, [statusColumns, triggerStatusColumnId]);

  const selectedGroup = useMemo(() => {
    return groups.find(g => g.id === destGroupId);
  }, [groups, destGroupId]);

  // Action type labels
  const actionLabels: Record<string, { label: string; icon: string }> = {
    'MOVE_TO_GROUP': { label: 'Move item to group', icon: '→' },
    'MOVE_TO_BOARD': { label: 'Move item to board', icon: '→' },
    'CALL_WEBHOOK': { label: 'Call webhook', icon: '🔗' },
    'SEND_EMAIL': { label: 'Send email', icon: '✉️' },
    'CHANGE_STATUS': { label: 'Change status', icon: '✓' },
    'NOTIFY': { label: 'Notify someone', icon: '🔔' }
  };

  function insertPlaceholder(placeholder: string) {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const textNode = document.createTextNode(placeholder);
      range.deleteContents();
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      
      // Update state
      setEmailTemplate(editor.innerHTML);
    } else {
      // If no selection, append at the end
      const textNode = document.createTextNode(placeholder);
      editor.appendChild(textNode);
      
      // Move cursor to end
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      
      setEmailTemplate(editor.innerHTML);
    }
    editor.focus();
  }

  // Initialize editor content when action changes to SEND_EMAIL
  useEffect(() => {
    if (action === 'SEND_EMAIL') {
      // Use requestAnimationFrame to ensure DOM is ready after conditional render
      const frameId = requestAnimationFrame(() => {
        if (editorRef.current && !editorInitializedRef.current) {
          try {
            editorRef.current.innerHTML = emailTemplate;
            editorInitializedRef.current = true;
          } catch (e) {
            console.error('Error initializing editor:', e);
          }
        }
      });
      return () => {
        cancelAnimationFrame(frameId);
        editorInitializedRef.current = false;
      };
    } else {
      editorInitializedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl p-6">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-semibold">Automations</h1>
          <button 
            className="rounded-md border px-3 py-1 text-sm hover:bg-muted transition-colors" 
            onClick={runNow}
          >
            Run automations
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

        <section className="mt-8">
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">Automation name</label>
            <input 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="Enter automation name"
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="mb-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input 
              type="checkbox" 
              checked={isActive} 
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active
          </label>
          </div>

          <form onSubmit={onCreateAutomation} className="mt-6 space-y-6">
          {/* Visual Flow: When this happens */}
          <div className="rounded-lg p-6 border bg-muted/50">
            <div className="text-sm font-medium mb-4">When this happens</div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <span>When</span>
              
              {/* Column selector */}
              <div className="relative" ref={columnDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowColumnDropdown(!showColumnDropdown);
                    setShowStatusValueDropdown(false);
                  }}
                  className="px-3 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors text-sm font-medium"
                >
                  {selectedColumn ? selectedColumn.name : 'Status'}
                </button>
                
                {showColumnDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    <div className="p-2 border-b">
                      <div className="text-xs text-muted-foreground px-2 py-1">Select a column</div>
                    </div>
                    {statusColumns.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          setTriggerStatusColumnId(col.id);
                          setShowColumnDropdown(false);
                          setTriggerTargetStatus(''); // Reset status when column changes
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 ${
                          triggerStatusColumnId === col.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="w-4 h-4 rounded border-2"></div>
                        <span className="text-sm">{col.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <span>changes to</span>

              {/* Status value selector */}
              <div className="relative" ref={statusValueDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    if (triggerStatusColumnId) {
                      setShowStatusValueDropdown(!showStatusValueDropdown);
                      setShowColumnDropdown(false);
                    }
                  }}
                  disabled={!triggerStatusColumnId}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                    selectedStatusOption
                      ? 'text-white'
                      : 'text-muted-foreground'
                  } ${!triggerStatusColumnId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
                  style={selectedStatusOption ? { backgroundColor: selectedStatusOption.color } : {}}
                >
                  {triggerTargetStatus === '__DEFAULT__' || !triggerTargetStatus ? 'Default (empty)' : triggerTargetStatus}
                </button>
                
                {showStatusValueDropdown && triggerStatusColumnId && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    <div className="p-2 border-b">
                      <div className="text-xs text-muted-foreground px-2 py-1">Select value</div>
                    </div>
                    {statusOptions.map((option) => {
                      const isDefault = option.label === '__DEFAULT__';
                      const isSelected = triggerTargetStatus === option.label || (!triggerTargetStatus && isDefault);
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            setTriggerTargetStatus(isDefault ? '' : option.label);
                            setShowStatusValueDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${
                            isSelected ? 'bg-muted' : ''
                          }`}
                        >
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: option.color }}
                          ></div>
                          <span className="text-sm">{isDefault ? 'Default (empty)' : option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center -my-2">
            <svg className="w-8 h-8 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          </div>

          {/* Visual Flow: Then do this */}
          <div className="rounded-lg p-6 border bg-muted/50">
            <div className="text-sm font-medium mb-4">Then do this</div>
            
            <div className="flex items-center gap-3 flex-wrap">
              <span>Then</span>
              
              {/* Action selector */}
              <div className="relative" ref={actionDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowActionDropdown(!showActionDropdown);
                    setShowGroupDropdown(false);
                  }}
                  className="px-3 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors text-sm font-medium"
                >
                  {actionLabels[action]?.label || 'do this'}
                </button>
                
                {showActionDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-72 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-2 border-b">
                      <div className="text-xs text-muted-foreground px-2 py-1">Most used</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAction('MOVE_TO_GROUP');
                        setShowActionDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${
                        action === 'MOVE_TO_GROUP' ? 'bg-muted' : ''
                      }`}
                    >
                      <span className="text-lg">→</span>
                      <span className="text-sm">move item to group</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction('NOTIFY');
                        setShowActionDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${
                        action === 'NOTIFY' ? 'bg-muted' : ''
                      }`}
                    >
                      <span className="text-lg">🔔</span>
                      <span className="text-sm">notify</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction('CHANGE_STATUS');
                        setShowActionDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${
                        action === 'CHANGE_STATUS' ? 'bg-muted' : ''
                      }`}
                    >
                      <span className="text-lg">✓</span>
                      <span className="text-sm">change status</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction('MOVE_TO_BOARD');
                        setShowActionDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${
                        action === 'MOVE_TO_BOARD' ? 'bg-muted' : ''
                      }`}
                    >
                      <span className="text-lg">+</span>
                      <span className="text-sm">create subitem</span>
                    </button>
                    <div className="p-2 border-t mt-2">
                      <div className="text-xs text-muted-foreground px-2 py-1">More actions</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAction('CALL_WEBHOOK');
                        setShowActionDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${
                        action === 'CALL_WEBHOOK' ? 'bg-muted' : ''
                      }`}
                    >
                      <span className="text-lg">🔗</span>
                      <span className="text-sm">call webhook</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAction('SEND_EMAIL');
                        setShowActionDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${
                        action === 'SEND_EMAIL' ? 'bg-muted' : ''
                      }`}
                    >
                      <span className="text-lg">✉️</span>
                      <span className="text-sm">send email</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Action-specific configuration */}
              {action === 'MOVE_TO_GROUP' && (
                <div className="mt-4">
                  <span>to group</span>
                  <div className="relative inline-block ml-3" ref={groupDropdownRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setShowGroupDropdown(!showGroupDropdown);
                        setShowActionDropdown(false);
                      }}
                      className="px-3 py-1.5 rounded-md border bg-background hover:bg-muted transition-colors text-sm font-medium"
                    >
                      {selectedGroup ? selectedGroup.name : 'group'}
                    </button>
                    
                    {showGroupDropdown && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                        <div className="p-2 border-b">
                          <input
                            type="text"
                            placeholder="Search group"
                            className="w-full px-2 py-1 border rounded text-sm"
                            autoFocus
                          />
                        </div>
                        {groups.map((g) => (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => {
                              setDestGroupId(g.id);
                              setShowGroupDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 ${
                              destGroupId === g.id ? 'bg-muted' : ''
                            }`}
                          >
                            <div className="w-3 h-3 rounded-full bg-muted"></div>
                            <span className="text-sm">{g.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action-specific configuration panels */}
          {action === 'MOVE_TO_BOARD' ? (
            <div className="rounded-lg p-4 border bg-muted/30 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Destination board</label>
                <select 
                  value={destBoardId} 
                  onChange={(e) => setDestBoardId(e.target.value)} 
                  className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Select board</option>
                  {boards
                    .filter((b) => b.id !== params.boardId)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">New status (optional)</label>
                  <input 
                    value={destStatus} 
                    onChange={(e) => setDestStatus(e.target.value)} 
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Destination status column (optional)</label>
                  <select
                    value={destStatusColumnId}
                    onChange={(e) => setDestStatusColumnId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select status column</option>
                    {statusColumnsInDest.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : action === 'SEND_EMAIL' ? (
            <div className="rounded-lg p-4 border bg-muted/30 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Email webhook URL</label>
                <input
                  value={emailWebhookUrl}
                  onChange={(e) => setEmailWebhookUrl(e.target.value)}
                  placeholder="https://api.example.com/send-email"
                  className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Your webhook should accept POST requests with email data (to, subject, body). Body will be HTML.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Email template (HTML)</label>
                <div className="mt-1 rounded-md border bg-background">
                  <div className="border-b p-2 flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        editorRef.current?.focus();
                        document.execCommand('bold', false);
                        if (editorRef.current) {
                          setEmailTemplate(editorRef.current.innerHTML);
                        }
                      }}
                      className="px-2 py-1 text-xs rounded border hover:bg-muted"
                      title="Bold"
                    >
                      <strong>B</strong>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        editorRef.current?.focus();
                        document.execCommand('italic', false);
                        if (editorRef.current) {
                          setEmailTemplate(editorRef.current.innerHTML);
                        }
                      }}
                      className="px-2 py-1 text-xs rounded border hover:bg-muted"
                      title="Italic"
                    >
                      <em>I</em>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        editorRef.current?.focus();
                        document.execCommand('underline', false);
                        if (editorRef.current) {
                          setEmailTemplate(editorRef.current.innerHTML);
                        }
                      }}
                      className="px-2 py-1 text-xs rounded border hover:bg-muted"
                      title="Underline"
                    >
                      <u>U</u>
                    </button>
                    <div className="border-l mx-1"></div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        editorRef.current?.focus();
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                          const range = selection.getRangeAt(0);
                          const h2 = document.createElement('h2');
                          h2.textContent = selection.toString() || 'Heading';
                          range.deleteContents();
                          range.insertNode(h2);
                          if (editorRef.current) {
                            setEmailTemplate(editorRef.current.innerHTML);
                          }
                        }
                      }}
                      className="px-2 py-1 text-xs rounded border hover:bg-muted"
                      title="Heading 2"
                    >
                      H2
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        editorRef.current?.focus();
                        const selection = window.getSelection();
                        if (selection && selection.rangeCount > 0) {
                          const range = selection.getRangeAt(0);
                          const p = document.createElement('p');
                          p.textContent = selection.toString() || 'Paragraph';
                          range.deleteContents();
                          range.insertNode(p);
                          if (editorRef.current) {
                            setEmailTemplate(editorRef.current.innerHTML);
                          }
                        }
                      }}
                      className="px-2 py-1 text-xs rounded border hover:bg-muted"
                      title="Paragraph"
                    >
                      P
                    </button>
                  </div>
                  {action === 'SEND_EMAIL' && isMounted && (
                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => {
                        isUserTypingRef.current = true;
                        const html = e.currentTarget.innerHTML;
                        setEmailTemplate(html);
                        setTimeout(() => {
                          isUserTypingRef.current = false;
                        }, 100);
                      }}
                      onBlur={() => {
                        isUserTypingRef.current = false;
                      }}
                      className="min-h-[200px] p-3 focus:outline-none"
                      style={{ whiteSpace: 'pre-wrap' }}
                    />
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use the toolbar above to format text, or type HTML directly. Placeholders will be replaced with actual values.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Placeholders (click to insert)</label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{{item.name}}')}
                    className="px-3 py-1.5 text-xs rounded-full border bg-muted hover:bg-muted/80 cursor-pointer font-medium transition-colors"
                  >
                    {"{{item.name}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{{status.value}}')}
                    className="px-3 py-1.5 text-xs rounded-full border bg-muted hover:bg-muted/80 cursor-pointer font-medium transition-colors"
                  >
                    {"{{status.value}}"}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{{board.name}}')}
                    className="px-3 py-1.5 text-xs rounded-full border bg-muted hover:bg-muted/80 cursor-pointer font-medium transition-colors"
                  >
                    {"{{board.name}}"}
                  </button>
                  {columns.slice(0, showAllPlaceholders ? columns.length : 10).map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => insertPlaceholder(`{{column.${col.name}}}`)}
                      className="px-3 py-1.5 text-xs rounded-full border bg-muted hover:bg-muted/80 cursor-pointer font-medium transition-colors"
                    >
                      {"{{column." + col.name + "}}"}
                    </button>
                  ))}
                  {columns.length > 10 && (
                    <button
                      type="button"
                      onClick={() => setShowAllPlaceholders(!showAllPlaceholders)}
                      className="px-3 py-1.5 text-xs rounded-full border bg-muted hover:bg-muted/80 cursor-pointer font-medium transition-colors"
                    >
                      {showAllPlaceholders ? '− Show less' : `+ ${columns.length - 10} more`}
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Status to set after email sent</label>
                  <input
                    value={emailAfterStatus}
                    onChange={(e) => setEmailAfterStatus(e.target.value)}
                    placeholder="e.g., Email Sent"
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Status column to update</label>
                  <select
                    value={emailAfterStatusColumnId}
                    onChange={(e) => setEmailAfterStatusColumnId(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select status column</option>
                    {statusColumns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : action === 'CALL_WEBHOOK' ? (
            <div className="rounded-lg p-4 border bg-muted/30 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Webhook URL</label>
                <input 
                  value={webhookUrl} 
                  onChange={(e) => setWebhookUrl(e.target.value)} 
                  className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Payload (JSON, optional)</label>
                <textarea
                  value={webhookPayload}
                  onChange={(e) => setWebhookPayload(e.target.value)}
                  className="w-full h-24 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
                />
              </div>
            </div>
          ) : null}

          <div className="pt-4">
            <button 
              type="submit" 
              className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
            >
              Create automation
            </button>
          </div>
          </form>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-medium mb-4">Existing automations</h2>
          <div className="mt-3 divide-y rounded-md border">
            {automations.length ? (
              automations.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {a.name}
                      {a.is_active ? (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">Active</span>
                      ) : (
                        <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {a.trigger_type} → {a.action_type}
                    </div>
                  </div>
                  <div className="shrink-0 space-x-2">
                    <button 
                      className="rounded-md border px-3 py-1 text-sm hover:bg-muted transition-colors" 
                      onClick={() => toggleActive(a)}
                    >
                      {a.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button 
                      className="rounded-md border px-3 py-1 text-sm text-destructive hover:bg-muted transition-colors" 
                      onClick={() => onDelete(a)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">No automations yet.</div>
            )}
          </div>
        </section>
    </main>
  );
}


