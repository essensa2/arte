"use client";
import React, { useState, useRef, useEffect } from 'react';

type ActionStep = {
  id: string;
  type: 'MOVE_TO_BOARD' | 'MOVE_TO_GROUP' | 'CALL_WEBHOOK' | 'SEND_EMAIL' | 'NOTIFY' | 'CHANGE_STATUS' | 'AI_FILL_FIELDS';
  config: any;
};

type Column = { id: string; name: string; type: string; config?: any };
type Board = { id: string; name: string };
type Group = { id: string; name: string };
type StatusOption = { label: string; color: string };

interface ActionStepEditorProps {
  step: ActionStep;
  stepIndex: number;
  columns: Column[];
  statusColumns: Column[];
  boards: Board[];
  groups: Group[];
  boardId: string;
  onChange: (step: ActionStep) => void;
  onDelete: () => void;
  canDelete: boolean;
  actionLabels: Record<string, { label: string; icon: string }>;
  isMounted: boolean;
}

export function ActionStepEditor({
  step,
  stepIndex,
  columns,
  statusColumns,
  boards,
  groups,
  boardId,
  onChange,
  onDelete,
  canDelete,
  actionLabels,
  isMounted
}: ActionStepEditorProps) {
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  const [showGroupDropdown, setShowGroupDropdown] = useState(false);
  const [showStatusColumnDropdown, setShowStatusColumnDropdown] = useState(false);
  const [showStatusValueDropdown, setShowStatusValueDropdown] = useState(false);
  const [showVariableDropdown, setShowVariableDropdown] = useState(false);
  const [variableDropdownTarget, setVariableDropdownTarget] = useState<string | null>(null);
  const actionDropdownRef = useRef<HTMLDivElement>(null);
  const groupDropdownRef = useRef<HTMLDivElement>(null);
  const statusColumnDropdownRef = useRef<HTMLDivElement>(null);
  const statusValueDropdownRef = useRef<HTMLDivElement>(null);
  const variableDropdownRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fieldInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Available variables
  const availableVariables = [
    { key: '{{item.name}}', label: 'Task Name' },
    { key: '{{item.id}}', label: 'Task ID' },
    { key: '{{board.name}}', label: 'Board Name' },
    { key: '{{status.value}}', label: 'Status Value' },
    ...columns.map(col => ({ key: `{{column.${col.name}}}`, label: col.name })),
  ];

  const selectedGroup = groups.find(g => g.id === step.config?.dest_group_id);

  // Get selected status column and its options
  const selectedStatusColumn = statusColumns.find(c => c.id === step.config?.status_column_id);
  const statusOptions: StatusOption[] = selectedStatusColumn?.config?.status_options || [];
  const selectedStatusValue = step.config?.status_value || '';

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (actionDropdownRef.current && !actionDropdownRef.current.contains(event.target as Node)) {
        setShowActionDropdown(false);
      }
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target as Node)) {
        setShowGroupDropdown(false);
      }
      if (statusColumnDropdownRef.current && !statusColumnDropdownRef.current.contains(event.target as Node)) {
        setShowStatusColumnDropdown(false);
      }
      if (statusValueDropdownRef.current && !statusValueDropdownRef.current.contains(event.target as Node)) {
        setShowStatusValueDropdown(false);
      }
      if (variableDropdownRef.current && !variableDropdownRef.current.contains(event.target as Node)) {
        setShowVariableDropdown(false);
        setVariableDropdownTarget(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Extract variables from text
  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{[^}]+\}\}/g) || [];
    return [...new Set(matches)];
  };

  // Insert variable into field
  const insertVariable = (variableKey: string, fieldName: 'to' | 'cc' | 'bcc' | 'subject') => {
    const currentValue = step.config?.[fieldName] || '';
    const newValue = currentValue + (currentValue ? ' ' : '') + variableKey;
    updateConfig({ [fieldName]: newValue });
    setShowVariableDropdown(false);
    setVariableDropdownTarget(null);
  };

  const lastSelectionRef = useRef<Range | null>(null);

  // Insert variable into email template
  const insertVariableIntoTemplate = (variableKey: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      const selection = window.getSelection();
      let range: Range;

      // Use the last known selection if available, otherwise try current selection
      if (lastSelectionRef.current) {
        range = lastSelectionRef.current;
      } else if (selection && selection.rangeCount > 0) {
        range = selection.getRangeAt(0);
      } else {
        // Create a range at the end of the content
        range = document.createRange();
        range.selectNodeContents(editorRef.current);
        range.collapse(false);
      }

      // Restore selection
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      // Insert the variable text
      const textNode = document.createTextNode(variableKey + ' ');
      range.insertNode(textNode);

      // Move cursor after the inserted text
      range.setStartAfter(textNode);
      range.collapse(true);

      // Update last known selection
      lastSelectionRef.current = range;

      // Update selection object
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      updateConfig({ email_template: editorRef.current.innerHTML });
    }
    setShowVariableDropdown(false);
    setVariableDropdownTarget(null);
  };

  const updateStep = (updates: Partial<ActionStep>) => {
    onChange({ ...step, ...updates });
  };

  const updateConfig = (configUpdates: any) => {
    onChange({ ...step, config: { ...step.config, ...configUpdates } });
  };

  useEffect(() => {
    if (
      editorRef.current &&
      step.config?.email_template !== undefined &&
      editorRef.current.innerHTML !== step.config.email_template
    ) {
      editorRef.current.innerHTML = step.config.email_template;
    }
  }, [step.config?.email_template]);

  return (
    <div className="space-y-4">
      {stepIndex > 0 ? (
        <div className="flex justify-center -my-2">
          <svg className="w-8 h-8 text-muted-foreground" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      ) : null}

      {/* Then do this */}
      <div className="rounded-lg p-6 border bg-muted/50 relative">
        {canDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="absolute top-2 right-2 text-muted-foreground hover:text-destructive p-1"
            title="Remove step"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        <div className="text-sm font-medium mb-4">Then do this {stepIndex > 0 && `(Step ${stepIndex + 1})`}</div>

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
              {actionLabels[step.type]?.label || 'do this'}
            </button>

            {showActionDropdown && (
              <div className="absolute top-full left-0 mt-2 w-72 bg-background border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                <div className="p-2 border-b">
                  <div className="text-xs text-muted-foreground px-2 py-1">Most used</div>
                </div>
                {(['AI_FILL_FIELDS', 'MOVE_TO_GROUP', 'NOTIFY', 'CHANGE_STATUS', 'MOVE_TO_BOARD', 'CALL_WEBHOOK', 'SEND_EMAIL'] as const).map((actionType) => (
                  <button
                    key={actionType}
                    type="button"
                    onClick={() => {
                      updateStep({ type: actionType, config: {} });
                      setShowActionDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-3 ${step.type === actionType ? 'bg-muted' : ''
                      }`}
                  >
                    <span className="text-lg">{actionLabels[actionType]?.icon || '•'}</span>
                    <span className="text-sm">{actionLabels[actionType]?.label || actionType}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action-specific inline configuration */}
          {step.type === 'MOVE_TO_GROUP' && (
            <div className="mt-4 w-full">
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
                          updateConfig({ dest_group_id: g.id });
                          setShowGroupDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 ${step.config?.dest_group_id === g.id ? 'bg-muted' : ''
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

        {/* Action-specific configuration panels */}
        {step.type === 'MOVE_TO_BOARD' ? (
          <div className="mt-4 rounded-lg p-4 border bg-muted/30 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Destination board</label>
              <select
                value={step.config?.dest_board_id || ''}
                onChange={(e) => updateConfig({ dest_board_id: e.target.value })}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select board</option>
                {boards
                  .filter((b) => b.id !== boardId)
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
                  value={step.config?.new_status || ''}
                  onChange={(e) => updateConfig({ new_status: e.target.value })}
                  className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Destination status column (optional)</label>
                <select
                  value={step.config?.status_column_id || ''}
                  onChange={(e) => updateConfig({ status_column_id: e.target.value })}
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
        ) : step.type === 'SEND_EMAIL' ? (
          <div className="mt-4 rounded-lg p-4 border bg-muted/30 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">From email address</label>
              <input
                value={step.config?.from || ''}
                onChange={(e) => updateConfig({ from: e.target.value })}
                placeholder="noreply@example.com"
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Variable Field Component */}
            {(['to', 'cc', 'bcc', 'subject'] as const).map((fieldName) => {
              const fieldValue = step.config?.[fieldName] || '';
              const variables = extractVariables(fieldValue);

              return (
                <div key={fieldName}>
                  <label className="block text-sm font-medium mb-2">
                    {fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
                    {fieldName === 'to' && <span className="text-destructive ml-1">*</span>}
                  </label>

                  {/* Show variables as badges above the input */}
                  {variables.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {variables.map((varKey, idx) => {
                        const varLabel = availableVariables.find(v => v.key === varKey)?.label || varKey;
                        return (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded border bg-muted/50 text-foreground"
                          >
                            {varLabel}
                            <button
                              type="button"
                              onClick={() => {
                                const newValue = fieldValue.replace(varKey, '').trim();
                                updateConfig({ [fieldName]: newValue });
                              }}
                              className="hover:text-destructive ml-0.5"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="relative">
                    <div className="flex items-center gap-2">
                      <input
                        ref={(el) => { fieldInputRefs.current[fieldName] = el; }}
                        type="text"
                        value={fieldValue}
                        onChange={(e) => {
                          updateConfig({ [fieldName]: e.target.value });
                        }}
                        className="flex-1 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-sm font-mono"
                        placeholder={fieldName === 'subject' ? 'Enter subject...' : fieldName === 'to' ? 'Enter email or add variable...' : 'Optional'}
                      />
                      <div className="relative" ref={variableDropdownTarget === fieldName ? variableDropdownRef : null}>
                        <button
                          type="button"
                          onClick={() => {
                            setShowVariableDropdown(!showVariableDropdown || variableDropdownTarget !== fieldName);
                            setVariableDropdownTarget(fieldName);
                          }}
                          className="px-2 py-2 text-xs rounded border hover:bg-muted transition-colors"
                        >
                          + {availableVariables.length}
                        </button>
                        {showVariableDropdown && variableDropdownTarget === fieldName && (
                          <div className="absolute top-full right-0 mt-2 w-64 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                            {availableVariables.map((variable) => (
                              <button
                                key={variable.key}
                                type="button"
                                onClick={() => {
                                  const input = fieldInputRefs.current[fieldName];
                                  if (input) {
                                    const cursorPos = input.selectionStart || 0;
                                    const before = fieldValue.substring(0, cursorPos);
                                    const after = fieldValue.substring(cursorPos);
                                    const newValue = before + variable.key + (after ? ' ' + after : '');
                                    updateConfig({ [fieldName]: newValue });
                                    setShowVariableDropdown(false);
                                    setVariableDropdownTarget(null);
                                    // Restore cursor position after variable
                                    setTimeout(() => {
                                      if (input) {
                                        input.focus();
                                        const newPos = cursorPos + variable.key.length + 1;
                                        input.setSelectionRange(newPos, newPos);
                                      }
                                    }, 0);
                                  } else {
                                    insertVariable(variable.key, fieldName);
                                  }
                                }}
                                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between"
                              >
                                <span className="text-sm">{variable.label}</span>
                                <span className="text-xs text-muted-foreground font-mono">{variable.key}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div>
              <label className="block text-sm font-medium mb-2">
                Email template (HTML)
                <span className="text-xs text-muted-foreground ml-2">
                  Variables: {`{{item.name}}`}, {`{{status.value}}`}, {`{{column.ColumnName}}`}, {`{{board.name}}`}
                </span>
              </label>
              <div className="mt-1 rounded-md border bg-background">
                <div className="border-b p-2 flex gap-2 flex-wrap items-center">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      editorRef.current?.focus();
                      document.execCommand('bold', false);
                      if (editorRef.current) {
                        updateConfig({ email_template: editorRef.current.innerHTML });
                      }
                    }}
                    className="px-2 py-1 text-xs rounded border hover:bg-muted"
                    title="Bold"
                  >
                    <strong>B</strong>
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      editorRef.current?.focus();
                      document.execCommand('italic', false);
                      if (editorRef.current) {
                        updateConfig({ email_template: editorRef.current.innerHTML });
                      }
                    }}
                    className="px-2 py-1 text-xs rounded border hover:bg-muted"
                    title="Italic"
                  >
                    <em>I</em>
                  </button>
                  <div className="flex-1"></div>
                  <div className="relative" ref={variableDropdownTarget === 'template' ? variableDropdownRef : null}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setShowVariableDropdown(!showVariableDropdown || variableDropdownTarget !== 'template');
                        setVariableDropdownTarget('template');
                      }}
                      className="px-2 py-1 text-xs rounded border hover:bg-muted transition-colors"
                    >
                      + {availableVariables.length}
                    </button>
                    {showVariableDropdown && variableDropdownTarget === 'template' && (
                      <div className="absolute top-full right-0 mt-2 w-64 bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                        {availableVariables.map((variable) => (
                          <button
                            key={variable.key}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => insertVariableIntoTemplate(variable.key)}
                            className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between"
                          >
                            <span className="text-sm">{variable.label}</span>
                            <span className="text-xs text-muted-foreground font-mono">{variable.key}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.preventDefault();
                      editorRef.current?.focus();
                      const url = prompt('Enter URL:');
                      if (url && editorRef.current) {
                        const selection = window.getSelection();
                        const selectedText = selection?.toString() || url;
                        document.execCommand('insertHTML', false, `<a href="${url}" target="_blank">${selectedText}</a>`);
                        updateConfig({ email_template: editorRef.current.innerHTML });
                      }
                    }}
                    className="px-2 py-1 text-xs rounded border hover:bg-muted"
                    title="Insert Link"
                  >
                    🔗 Link
                  </button>
                </div>
                {isMounted && (
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) => {
                      updateConfig({ email_template: e.currentTarget.innerHTML });
                    }}
                    onBlur={() => {
                      const selection = window.getSelection();
                      if (selection && selection.rangeCount > 0) {
                        lastSelectionRef.current = selection.getRangeAt(0).cloneRange();
                      }
                    }}
                    onKeyUp={() => {
                      const selection = window.getSelection();
                      if (selection && selection.rangeCount > 0) {
                        lastSelectionRef.current = selection.getRangeAt(0).cloneRange();
                      }
                    }}
                    onMouseUp={() => {
                      const selection = window.getSelection();
                      if (selection && selection.rangeCount > 0) {
                        lastSelectionRef.current = selection.getRangeAt(0).cloneRange();
                      }
                    }}
                    className="min-h-[200px] p-3 focus:outline-none [&_a]:text-blue-600 [&_a]:underline [&_a:hover]:text-blue-800"
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status to set after email sent</label>
                <input
                  value={step.config?.after_status || ''}
                  onChange={(e) => updateConfig({ after_status: e.target.value })}
                  placeholder="e.g., Email Sent"
                  className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Status column to update</label>
                <select
                  value={step.config?.after_status_column_id || ''}
                  onChange={(e) => updateConfig({ after_status_column_id: e.target.value })}
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
        ) : step.type === 'CALL_WEBHOOK' ? (
          <div className="mt-4 rounded-lg p-4 border bg-muted/30 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Webhook URL</label>
              <input
                value={step.config?.url || ''}
                onChange={(e) => updateConfig({ url: e.target.value })}
                className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Payload (JSON, optional)</label>
              <textarea
                value={step.config?.payload ? JSON.stringify(step.config.payload, null, 2) : '{}'}
                onChange={(e) => {
                  try {
                    const parsed = JSON.parse(e.target.value);
                    updateConfig({ payload: parsed });
                  } catch {
                    // Invalid JSON, but allow typing
                  }
                }}
                className="w-full h-24 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              />
            </div>
          </div>
        ) : step.type === 'CHANGE_STATUS' ? (
          <div className="mt-4 rounded-lg p-4 border bg-muted/30 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Status column</label>
              <div className="relative" ref={statusColumnDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowStatusColumnDropdown(!showStatusColumnDropdown);
                    setShowStatusValueDropdown(false);
                  }}
                  className="w-full px-3 py-2 rounded-md border bg-background hover:bg-muted transition-colors text-sm text-left flex items-center justify-between"
                >
                  <span>{selectedStatusColumn ? selectedStatusColumn.name : 'Select status column'}</span>
                  <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showStatusColumnDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-full bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                    {statusColumns.map((col) => (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => {
                          updateConfig({ status_column_id: col.id, status_value: '' });
                          setShowStatusColumnDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 ${step.config?.status_column_id === col.id ? 'bg-muted' : ''
                          }`}
                      >
                        <span className="text-sm">{col.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {selectedStatusColumn && (
              <div>
                <label className="block text-sm font-medium mb-2">Status value</label>
                <div className="relative" ref={statusValueDropdownRef}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowStatusValueDropdown(!showStatusValueDropdown);
                      setShowStatusColumnDropdown(false);
                    }}
                    className="w-full px-3 py-2 rounded-md border bg-background hover:bg-muted transition-colors text-sm text-left flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      {selectedStatusValue ? (
                        <>
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: statusOptions.find(opt => opt.label === selectedStatusValue)?.color || '#gray' }}
                          ></div>
                          <span>{selectedStatusValue}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground">No status</span>
                      )}
                    </span>
                    <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showStatusValueDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-background border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          updateConfig({ status_value: '' });
                          setShowStatusValueDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 ${!selectedStatusValue ? 'bg-muted' : ''
                          }`}
                      >
                        <span className="text-sm text-muted-foreground">No status</span>
                      </button>
                      {statusOptions.map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => {
                            updateConfig({ status_value: option.label });
                            setShowStatusValueDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 ${selectedStatusValue === option.label ? 'bg-muted' : ''
                            }`}
                        >
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: option.color }}
                          ></div>
                          <span className="text-sm">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : step.type === 'AI_FILL_FIELDS' ? (
          <div className="mt-4 rounded-lg p-4 border bg-muted/30 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                AI Instructions
                <span className="text-destructive ml-1">*</span>
              </label>
              <textarea
                value={step.config?.ai_instructions || ''}
                onChange={(e) => updateConfig({ ai_instructions: e.target.value })}
                placeholder="Example: Based on the customer's request in the 'Description' field, generate a professional response and estimate delivery time."
                className="w-full h-32 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tell the AI what to do. It has access to all item data including: {`{{item.name}}`}, {`{{status.value}}`}, and all column values.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Field Mappings</label>
              <p className="text-xs text-muted-foreground mb-3">
                Tell the AI which fields to fill and what to put in each field
              </p>

              {(step.config?.field_mappings || [{ field_name: '', instruction: '' }]).map((mapping: any, idx: number) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <select
                    value={mapping.column_id || ''}
                    onChange={(e) => {
                      const newMappings = [...(step.config?.field_mappings || [])];
                      newMappings[idx] = { ...mapping, column_id: e.target.value };
                      updateConfig({ field_mappings: newMappings });
                    }}
                    className="flex-1 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  >
                    <option value="">Select field to fill</option>
                    {columns.filter(c => c.type !== 'status').map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name} ({col.type})
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={mapping.instruction || ''}
                    onChange={(e) => {
                      const newMappings = [...(step.config?.field_mappings || [])];
                      newMappings[idx] = { ...mapping, instruction: e.target.value };
                      updateConfig({ field_mappings: newMappings });
                    }}
                    placeholder="What should AI put in this field?"
                    className="flex-1 rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newMappings = (step.config?.field_mappings || []).filter((_: any, i: number) => i !== idx);
                      updateConfig({ field_mappings: newMappings.length > 0 ? newMappings : [{ field_name: '', instruction: '' }] });
                    }}
                    className="px-2 py-1 text-destructive hover:bg-destructive/10 rounded"
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const newMappings = [...(step.config?.field_mappings || []), { column_id: '', instruction: '' }];
                  updateConfig({ field_mappings: newMappings });
                }}
                className="text-sm text-primary hover:underline"
              >
                + Add field
              </button>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <strong>Example:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                <li><strong>Instructions:</strong> "Analyze the customer request and generate a professional response"</li>
                <li><strong>Field: Response →</strong> "Generate a helpful response to the customer"</li>
                <li><strong>Field: Priority →</strong> "Determine urgency (Low/Medium/High)"</li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

