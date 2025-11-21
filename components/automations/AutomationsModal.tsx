"use client";
import { useEffect, useMemo, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { createPortal } from 'react-dom';
import { ActionStepEditor } from './ActionStepEditor';

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

interface AutomationsModalProps {
  workspaceId: string;
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function AutomationsModal({ workspaceId, boardId, isOpen, onClose }: AutomationsModalProps) {
  const supabase = createClient();
  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<Column[]>([]);
  const [statusColumns, setStatusColumns] = useState<Column[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  type ActionStep = {
    id: string;
    type: 'MOVE_TO_BOARD' | 'MOVE_TO_GROUP' | 'CALL_WEBHOOK' | 'SEND_EMAIL' | 'NOTIFY' | 'CHANGE_STATUS' | 'AI_FILL_FIELDS';
    config: any;
  };

  // Form state
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [triggerStatusColumnId, setTriggerStatusColumnId] = useState('');
  const [triggerTargetStatus, setTriggerTargetStatus] = useState('Done');
  const [actionSteps, setActionSteps] = useState<ActionStep[]>([
    { id: '1', type: 'MOVE_TO_GROUP', config: {} }
  ]);
  const [showAllPlaceholders, setShowAllPlaceholders] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const editorRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isUserTypingRefs = useRef<Record<string, boolean>>({});
  const editorInitializedRefs = useRef<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Dropdown states
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [showStatusValueDropdown, setShowStatusValueDropdown] = useState(false);
  const columnDropdownRef = useRef<HTMLDivElement>(null);
  const statusValueDropdownRef = useRef<HTMLDivElement>(null);

  function resetForm() {
    setName('');
    setIsActive(true);
    setTriggerStatusColumnId('');
    setTriggerTargetStatus('Done');
    setActionSteps([{ id: String(Date.now()), type: 'MOVE_TO_GROUP', config: {} }]);
    setShowAllPlaceholders(false);
    setEditingAutomationId(null);
  }

  useEffect(() => {
    if (!isOpen) {
      resetForm();
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      const [bRes, colsRes, boardsRes, groupsRes, autoRes] = await Promise.all([
        supabase.from('boards').select('id,name').eq('id', boardId).single(),
        supabase.from('columns').select('id,name,type,config').eq('board_id', boardId),
        supabase.from('boards').select('id,name').eq('workspace_id', workspaceId).order('name', { ascending: true }),
        supabase.from('groups').select('id,name').eq('board_id', boardId).order('name', { ascending: true }),
        supabase.from('automations').select('*').eq('board_id', boardId).order('created_at', { ascending: true })
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
  }, [supabase, boardId, workspaceId, isOpen]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (columnDropdownRef.current && !columnDropdownRef.current.contains(event.target as Node)) {
        setShowColumnDropdown(false);
      }
      if (statusValueDropdownRef.current && !statusValueDropdownRef.current.contains(event.target as Node)) {
        setShowStatusValueDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close modal on Escape key and prevent body scroll
  useEffect(() => {
    if (!isOpen) return;

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  function addActionStep() {
    setActionSteps([...actionSteps, { id: String(Date.now()), type: 'MOVE_TO_GROUP', config: {} }]);
  }

  function removeActionStep(stepId: string) {
    if (actionSteps.length > 1) {
      setActionSteps(actionSteps.filter(s => s.id !== stepId));
    }
  }

  function updateActionStep(stepId: string, updatedStep: ActionStep) {
    setActionSteps(actionSteps.map(s => s.id === stepId ? updatedStep : s));
  }

  function startEdit(a: Automation) {
    setName(a.name);
    setIsActive(a.is_active);
    setTriggerStatusColumnId(a.trigger_config?.column_id || '');
    setTriggerTargetStatus(a.trigger_config?.target_status || 'Done');

    // Handle both old format (single action) and new format (array of actions)
    let steps: ActionStep[] = [];
    if (Array.isArray(a.action_config)) {
      // New format: array of actions
      steps = a.action_config.map((action: any, index: number) => ({
        id: String(index + 1),
        type: action.type || a.action_type,
        config: action.config || action
      }));
    } else {
      // Old format: single action
      steps = [{
        id: '1',
        type: a.action_type as any,
        config: a.action_config || {}
      }];
    }

    setActionSteps(steps.length > 0 ? steps : [{ id: '1', type: 'MOVE_TO_GROUP', config: {} }]);
    setEditingAutomationId(a.id);

    // Scroll to top of form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

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
    if (actionSteps.length === 0) {
      setError('At least one action step is required');
      return;
    }

    // Validate each action step
    for (const step of actionSteps) {
      if (step.type === 'MOVE_TO_GROUP' && !step.config?.dest_group_id) {
        setError('Select destination group for "Move item to group" action');
        return;
      }
      if (step.type === 'MOVE_TO_BOARD' && !step.config?.dest_board_id) {
        setError('Select destination board for "Move item to board" action');
        return;
      }
      if (step.type === 'SEND_EMAIL') {
        if (!step.config?.from) {
          setError('From email address required for "Send email" action');
          return;
        }
        if (!step.config?.to) {
          setError('To email address required for "Send email" action');
          return;
        }
        if (!step.config?.email_template?.trim()) {
          setError('Email template required for "Send email" action');
          return;
        }
      }
      if (step.type === 'CALL_WEBHOOK' && !step.config?.url) {
        setError('Webhook URL required for "Call webhook" action');
        return;
      }
      if (step.type === 'CHANGE_STATUS' && !step.config?.status_column_id) {
        setError('Select status column for "Change status" action');
        return;
      }
      if (step.type === 'AI_FILL_FIELDS') {
        if (!step.config?.ai_instructions?.trim()) {
          setError('AI instructions required for "Use AI to fill fields" action');
          return;
        }
        if (!step.config?.field_mappings || step.config.field_mappings.length === 0) {
          setError('At least one field mapping required for "Use AI to fill fields" action');
          return;
        }
        for (const mapping of step.config.field_mappings) {
          if (!mapping.column_id) {
            setError('Select a field for all AI field mappings');
            return;
          }
        }
      }
    }

    // Convert action steps to array format for storage
    // Store as array: [{type: 'MOVE_TO_GROUP', config: {...}}, ...]
    const action_config_array = actionSteps.map(step => ({
      type: step.type,
      config: step.config
    }));

    // For backward compatibility, also set action_type to first action's type
    const firstActionType = actionSteps[0].type;
    // Store the array in action_config
    const action_config = action_config_array;

    if (editingAutomationId) {
      // Update existing automation
      const { data, error } = await supabase
        .from('automations')
        .update({
          name,
          is_active: isActive,
          trigger_type: 'STATUS_CHANGED',
          trigger_config: { column_id: triggerStatusColumnId, target_status: triggerTargetStatus },
          action_type: firstActionType, // Keep for backward compatibility
          action_config // Store as array
        })
        .eq('id', editingAutomationId)
        .select('*')
        .single();
      if (error) {
        setError(error.message);
        return;
      }
      setAutomations((prev) => prev.map((a) => (a.id === editingAutomationId ? data : a)));
    } else {
      // Create new automation
      const { data, error } = await supabase
        .from('automations')
        .insert({
          board_id: boardId,
          name,
          is_active: isActive,
          trigger_type: 'STATUS_CHANGED',
          trigger_config: { column_id: triggerStatusColumnId, target_status: triggerTargetStatus },
          action_type: firstActionType, // Keep for backward compatibility
          action_config // Store as array
        })
        .select('*')
        .single();
      if (error) {
        setError(error.message);
        return;
      }
      setAutomations((prev) => [...prev, data]);
    }

    resetForm();
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
    // If we were editing this automation, reset the form
    if (editingAutomationId === a.id) {
      resetForm();
    }
  }

  async function runNow() {
    setError(null);
    const res = await fetch('/api/automation/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board_id: boardId })
    });
    if (!res.ok) {
      const t = await res.text();
      setError(`Run failed: ${t}`);
    }
  }

  const selectedStatusColumn = useMemo(() => {
    return statusColumns.find(c => c.id === triggerStatusColumnId);
  }, [statusColumns, triggerStatusColumnId]);

  const statusOptions: StatusOption[] = useMemo(() => {
    const defaultOption = { label: 'Status...', color: '#c4c4c4' };

    if (!selectedStatusColumn) {
      return [
        defaultOption,
        { label: 'Done', color: '#00c875' },
        { label: 'Working on it', color: '#fdab3d' },
        { label: 'Stuck', color: '#e2445c' }
      ];
    }

    const options = selectedStatusColumn.config?.status_options || [
      { label: 'Done', color: '#00c875' },
      { label: 'Working on it', color: '#fdab3d' },
      { label: 'Stuck', color: '#e2445c' }
    ];

    return [defaultOption, ...options];
  }, [selectedStatusColumn]);

  const selectedStatusOption = useMemo(() => {
    return statusOptions.find(opt => opt.label === triggerTargetStatus);
  }, [statusOptions, triggerTargetStatus]);

  const selectedColumn = useMemo(() => {
    return statusColumns.find(c => c.id === triggerStatusColumnId);
  }, [statusColumns, triggerStatusColumnId]);

  const actionLabels: Record<string, { label: string; icon: string }> = {
    'AI_FILL_FIELDS': { label: 'Use AI to fill fields', icon: '🤖' },
    'MOVE_TO_GROUP': { label: 'Move item to group', icon: '→' },
    'MOVE_TO_BOARD': { label: 'Move item to board', icon: '→' },
    'CALL_WEBHOOK': { label: 'Call webhook', icon: '🔗' },
    'SEND_EMAIL': { label: 'Send email', icon: '✉️' },
    'CHANGE_STATUS': { label: 'Change status', icon: '✓' },
    'NOTIFY': { label: 'Notify someone', icon: '🔔' }
  };

  if (!mounted || !isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Blurred backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h1 className="text-2xl font-semibold">Automations</h1>
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border px-3 py-1 text-sm hover:bg-muted transition-colors"
              onClick={runNow}
            >
              Run automations
            </button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading...</div>
          ) : (
            <>
              {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

              <section>
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
                                  setTriggerTargetStatus('');
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 ${triggerStatusColumnId === col.id ? 'bg-muted' : ''
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
                          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${selectedStatusOption
                              ? 'text-white'
                              : 'text-muted-foreground'
                            } ${!triggerStatusColumnId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
                          style={selectedStatusOption ? { backgroundColor: selectedStatusOption.color } : {}}
                        >
                          {triggerTargetStatus || 'something'}
                        </button>

                        {showStatusValueDropdown && triggerStatusColumnId && (
                          <div className="absolute top-full left-0 mt-2 w-64 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                            <div className="p-2 border-b">
                              <div className="text-xs text-muted-foreground px-2 py-1">Select value</div>
                            </div>
                            {statusOptions.map((option) => (
                              <button
                                key={option.label}
                                type="button"
                                onClick={() => {
                                  setTriggerTargetStatus(option.label);
                                  setShowStatusValueDropdown(false);
                                }}
                                className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${triggerTargetStatus === option.label ? 'bg-muted' : ''
                                  }`}
                              >
                                <div
                                  className="w-4 h-4 rounded-full"
                                  style={{ backgroundColor: option.color }}
                                ></div>
                                <span className="text-sm">{option.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Steps */}
                  <div className="space-y-4">
                    {actionSteps.map((step, index) => (
                      <ActionStepEditor
                        key={step.id}
                        step={step}
                        stepIndex={index}
                        columns={columns}
                        statusColumns={statusColumns}
                        boards={boards}
                        groups={groups}
                        boardId={boardId}
                        onChange={(updatedStep) => updateActionStep(step.id, updatedStep)}
                        onDelete={() => removeActionStep(step.id)}
                        canDelete={actionSteps.length > 1}
                        actionLabels={actionLabels}
                        isMounted={isMounted}
                      />
                    ))}

                    {/* Add more action step button */}
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={addActionStep}
                        className="flex items-center gap-2 rounded-md border border-dashed px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add another action
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-2">
                    <button
                      type="submit"
                      className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
                    >
                      {editingAutomationId ? 'Update automation' : 'Create automation'}
                    </button>
                    {editingAutomationId && (
                      <button
                        type="button"
                        onClick={resetForm}
                        className="rounded-md border px-4 py-2 text-sm hover:bg-muted"
                      >
                        Cancel
                      </button>
                    )}
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
                            onClick={() => startEdit(a)}
                          >
                            Edit
                          </button>
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
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

