"use client";

import * as React from 'react';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusEditor } from './StatusEditor';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Link from 'next/link';

type Column = {
  id: string;
  board_id: string;
  name: string;
  type: 'text' | 'number' | 'status' | 'date' | 'person' | 'checkbox' | 'link' | 'long_text' | 'money' | 'email' | 'phone';
  position: number;
  config: any;
  hidden: boolean;
  width: number;
};

type Item = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  group_id: string | null;
};

type Group = {
  id: string;
  board_id: string;
  name: string;
  position: number;
  color: string | null;
  collapsed: boolean;
};

type StatusOption = {
  label: string;
  color: string;
};

type Props = {
  boardId: string;
  workspaceId: string;
};

export function BoardTable(props: Props) {
  const supabase = createClient();
  const { boardId, workspaceId } = props;
  const [columns, setColumns] = useState<Column[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [cellValues, setCellValues] = useState<Record<string, Record<string, any>>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState<string>('');
  const [editingStatusColumnId, setEditingStatusColumnId] = useState<string | null>(null);
  const [statusOptions, setStatusOptions] = useState<StatusOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [editingGroupColorId, setEditingGroupColorId] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showMassActions, setShowMassActions] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusModalColumn, setStatusModalColumn] = useState<Column | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const loadBoardData = React.useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    const [{ data: cols, error: ce }, { data: its, error: ie }, { data: grps, error: ge }] = await Promise.all([
      supabase.from('columns').select('*').eq('board_id', boardId).order('position', { ascending: true }),
      supabase.from('items').select('id,board_id,name,position,group_id').eq('board_id', boardId).order('position', { ascending: true }),
      supabase.from('groups').select('*').eq('board_id', boardId).order('position', { ascending: true })
    ]);

    if (ce || ie || ge) {
      setError(ce?.message ?? ie?.message ?? ge?.message ?? 'Failed to load');
      if (showLoading) setLoading(false);
      return;
    }

    const itemIds = (its ?? []).map((i) => i.id);
    const colIds = (cols ?? []).map((c) => c.id);

    const { data: cv, error: cve } = await supabase
      .from('cell_values')
      .select('item_id,column_id,value')
      .in('item_id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000'])
      .in('column_id', colIds.length ? colIds : ['00000000-0000-0000-0000-000000000000']);

    if (cve) {
      setError(cve.message);
    } else {
      setColumns(cols ?? []);
      setItems(its ?? []);
      setGroups(grps ?? []);
      const map: Record<string, Record<string, any>> = {};
      (its ?? []).forEach((i) => (map[i.id] = {}));
      (cv ?? []).forEach((c) => {
        if (!map[c.item_id]) map[c.item_id] = {};
        map[c.item_id][c.column_id] = c.value;
      });
      setCellValues(map);
    }
    if (showLoading) setLoading(false);
  }, [boardId, supabase]);

  useEffect(() => {
    loadBoardData();
  }, [loadBoardData]);

  async function onAddItem(groupId: string | null = null) {
    const name = prompt('Item name:');
    if (!name) return;

    // Calculate position within the group
    const groupItems = items.filter(i => i.group_id === groupId);
    const position = groupItems.length;

    const tempId = crypto.randomUUID();
    const newItem = { id: tempId, board_id: boardId, name, position, group_id: groupId };
    setItems([...items, newItem]);
    setCellValues({ ...cellValues, [tempId]: {} });

    const { data, error } = await supabase
      .from('items')
      .insert({ board_id: boardId, name, position, group_id: groupId })
      .select()
      .single();

    if (error) {
      toast.error('Error creating item', { description: error.message });
      setItems(items);
    } else {
      setItems((prev) => prev.map((i) => (i.id === tempId ? data : i)));
      setCellValues((prev) => {
        const n = { ...prev };
        n[data.id] = n[tempId];
        delete n[tempId];
        return n;
      });
    }
  }

  async function onAddGroup() {
    const name = prompt('Group name:');
    if (!name) return;

    const { data, error } = await supabase
      .from('groups')
      .insert({ board_id: boardId, name, position: groups.length, color: '#0073ea' })
      .select()
      .single();

    if (error) {
      toast.error('Error creating group', { description: error.message });
    } else {
      setGroups([...groups, data]);
    }
  }

  async function onAddColumn() {
    const name = prompt('Column name:');
    if (!name) return;
    const type = 'text';
    const { data, error } = await supabase
      .from('columns')
      .insert({ board_id: boardId, name, type, position: columns.length, config: {} })
      .select()
      .single();
    if (error) {
      toast.error('Error creating column', { description: error.message });
    } else {
      setColumns([...columns, data]);
    }
  }

  async function onUpdateCell(itemId: string, columnId: string, value: any) {
    const old = cellValues[itemId]?.[columnId];
    setCellValues((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [columnId]: value }
    }));

    // Ensure value is always valid JSONB (not SQL null)
    // Use database function to handle JSONB null correctly
    // The function will convert SQL NULL to JSONB null
    let jsonbValue: any = value;
    
    // If value is null/undefined, pass null and let the database function handle it
    // Otherwise, pass the value as-is (Supabase will convert to JSONB)
    if (value === null || value === undefined) {
      jsonbValue = null;
    }

    // Use RPC function to safely upsert with JSONB null handling
    const { error } = await supabase.rpc('upsert_cell_value', {
      p_item_id: itemId,
      p_column_id: columnId,
      p_value: jsonbValue
    });

    if (error) {
      toast.error('Failed to save', { description: error.message });
      setCellValues((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], [columnId]: old }
      }));
      return;
    }

    // Process automations after status change (for status columns)
    const column = columns.find(c => c.id === columnId);
    if (column && column.type === 'status') {
      console.log('Status changed - triggering automation processing', {
        itemId,
        columnId,
        value,
        valueType: typeof value,
        boardId,
        columnName: column.name
      });
      // Small delay to ensure database trigger has created the event
      setTimeout(async () => {
        try {
          console.log('Calling automation API...');
          const response = await fetch('/api/automation/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ board_id: boardId })
          });
          const result = await response.json();
          console.log('Automation API response:', JSON.stringify(result, null, 2));
          if (!response.ok) {
            console.error('Automation processing failed:', result);
          } else {
            // Reload board data immediately to reflect automation changes (e.g., items moved to different groups)
            console.log('Automation processed successfully, reloading board data...');
            await loadBoardData(false);
            console.log('Board data reloaded');
          }
        } catch (e) {
          console.error('Failed to process automations:', e);
        }
      }, 500);
    }
  }

  async function onRenameItem(itemId: string, newName: string) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, name: newName } : i)));
    await supabase.from('items').update({ name: newName }).eq('id', itemId);
  }

  async function onDeleteItem(itemId: string) {
    if (!confirm('Delete item?')) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    await supabase.from('items').delete().eq('id', itemId);
  }

  async function onRenameColumn(colId: string, newName: string) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, name: newName } : c)));
    await supabase.from('columns').update({ name: newName }).eq('id', colId);
    setEditingColumnId(null);
  }

  async function onDeleteColumn(colId: string) {
    if (!confirm('Delete column?')) return;

    const oldColumns = columns;
    setColumns((prev) => prev.filter((c) => c.id !== colId));

    const { error } = await supabase.from('columns').delete().eq('id', colId);

    if (error) {
      toast.error('Error deleting column', { description: error.message });
      setColumns(oldColumns);
    }
  }

  async function onChangeColumnType(colId: string, newType: Column['type']) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, type: newType } : c)));
    await supabase.from('columns').update({ type: newType }).eq('id', colId);
  }

  async function onToggleColumnVisibility(colId: string) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, hidden: !c.hidden } : c)));
    const column = columns.find((c) => c.id === colId);
    if (column) {
      await supabase.from('columns').update({ hidden: !column.hidden }).eq('id', colId);
    }
  }

  async function onUpdateColumnWidth(colId: string, newWidth: number) {
    setColumns((prev) => prev.map((c) => (c.id === colId ? { ...c, width: newWidth } : c)));
    await supabase.from('columns').update({ width: newWidth }).eq('id', colId);
  }

  async function onRenameGroup(groupId: string, newName: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, name: newName } : g)));
    await supabase.from('groups').update({ name: newName }).eq('id', groupId);
    setEditingGroupId(null);
  }

  async function onDeleteGroup(groupId: string) {
    if (!confirm('Delete group? Items in this group will be moved to "No Group".')) return;
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    // Items will have their group_id set to null by the database cascade
    setItems((prev) => prev.map((i) => (i.group_id === groupId ? { ...i, group_id: null } : i)));
    await supabase.from('groups').delete().eq('id', groupId);
  }

  async function onToggleGroupCollapse(groupId: string) {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, collapsed: !g.collapsed } : g)));
    await supabase.from('groups').update({ collapsed: !group.collapsed }).eq('id', groupId);
  }

  async function onUpdateGroupColor(groupId: string, color: string) {
    setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, color } : g)));
    const { error } = await supabase.from('groups').update({ color }).eq('id', groupId);
    if (error) {
      toast.error('Failed to update color', { description: error.message });
      // Revert on error
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        setGroups((prev) => prev.map((g) => (g.id === groupId ? { ...g, color: group.color } : g)));
      }
    }
  }

  function onOpenStatusEditor(colId: string) {
    const column = columns.find((c) => c.id === colId);
    if (!column) return;

    // Load existing status options or use defaults
    const existingOptions = column.config?.status_options || [
      { label: 'Done', color: '#00c875' },
      { label: 'Working on it', color: '#fdab3d' },
      { label: 'Stuck', color: '#e2445c' }
    ];

    setStatusOptions(existingOptions);
    setEditingStatusColumnId(colId);
  }

  async function onSaveStatusOptions(options: StatusOption[]) {
    if (!editingStatusColumnId) return;

    const column = columns.find((c) => c.id === editingStatusColumnId);
    if (!column) return;

    const newConfig = { ...column.config, status_options: options };

    setColumns((prev) => prev.map((c) =>
      c.id === editingStatusColumnId ? { ...c, config: newConfig } : c
    ));

    const { error } = await supabase
      .from('columns')
      .update({ config: newConfig })
      .eq('id', editingStatusColumnId);

    if (error) {
      toast.error('Failed to save status options', { description: error.message });
    } else {
      toast.success('Status options saved', { description: 'Status options updated successfully' });
      setEditingStatusColumnId(null);
      setStatusOptions([]);
    }
  }


  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const activeItem = items.find((i) => i.id === active.id);
    if (!activeItem) return;

    // Check if we're dropping over a group header or an item
    const overGroup = groups.find((g) => g.id === over.id);
    const overItem = items.find((i) => i.id === over.id);

    let newGroupId: string | null = null;
    let newPosition: number = 0;

    if (overGroup) {
      // Dropped on a group header
      newGroupId = overGroup.id;
      const groupItems = items.filter((i) => i.group_id === newGroupId);
      newPosition = groupItems.length;
    } else if (overItem) {
      // Dropped on another item
      newGroupId = overItem.group_id;
      const groupItems = items.filter((i) => i.group_id === newGroupId);
      const overIndex = groupItems.findIndex((i) => i.id === over.id);
      newPosition = overIndex >= 0 ? overIndex : groupItems.length;
    } else {
      // Dropped in "No Group" area
      newGroupId = null;
      const ungroupedItems = items.filter((i) => i.group_id === null);
      newPosition = ungroupedItems.length;
    }

    // Update local state optimistically
    const updatedItems = items.map((item) => {
      if (item.id === active.id) {
        return { ...item, group_id: newGroupId, position: newPosition };
      }
      // Reorder items in the target group
      if (item.group_id === newGroupId && item.id !== active.id) {
        if (item.position >= newPosition) {
          return { ...item, position: item.position + 1 };
        }
      }
      return item;
    });

    setItems(updatedItems);

    // Update in database
    const { error } = await supabase
      .from('items')
      .update({ group_id: newGroupId, position: newPosition })
      .eq('id', active.id);

    if (error) {
      toast.error('Failed to move item', { description: error.message });
      // Revert on error
      setItems(items);
    }
  }

  // Filter items based on search query
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  // Group items by group_id
  const groupedItems = React.useMemo(() => {
    const grouped: Record<string, Item[]> = { 'null': [] };
    groups.forEach((g) => (grouped[g.id] = []));

    filteredItems.forEach((item) => {
      const key = item.group_id ?? 'null';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(item);
    });

    return grouped;
  }, [filteredItems, groups]);

  // Update showMassActions based on selectedItems
  React.useEffect(() => {
    setShowMassActions(selectedItems.size > 0);
  }, [selectedItems]);

  // Select all items
  function handleSelectAll() {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  }

  // Toggle item selection
  function handleToggleItem(itemId: string) {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  }

  // Mass delete
  async function handleMassDelete() {
    if (selectedItems.size === 0) return;
    if (!confirm(`Delete ${selectedItems.size} item(s)?`)) return;

    const itemsToDelete = Array.from(selectedItems);
    setItems((prev) => prev.filter((i) => !selectedItems.has(i.id)));
    setSelectedItems(new Set());

    const { error } = await supabase
      .from('items')
      .delete()
      .in('id', itemsToDelete);

    if (error) {
      toast.error('Error deleting items', { description: error.message });
      // Reload items on error
      const { data } = await supabase
        .from('items')
        .select('id,board_id,name,position,group_id')
        .eq('board_id', boardId)
        .order('position', { ascending: true });
      if (data) setItems(data);
    } else {
      toast.success('Items deleted', { description: `${itemsToDelete.length} item(s) deleted successfully` });
    }
  }

  // Mass move to group
  function openGroupModal() {
    if (selectedItems.size === 0) return;
    setShowGroupModal(true);
  }

  async function handleMassMoveToGroup(targetGroupId: string | null) {
    if (selectedItems.size === 0) return;
    setShowGroupModal(false);

    const itemsToMove = Array.from(selectedItems);
    const targetGroupItems = items.filter(i => i.group_id === targetGroupId);
    let newPosition = targetGroupItems.length;

    // Update local state
    setItems((prev) => prev.map((item) => {
      if (selectedItems.has(item.id)) {
        return { ...item, group_id: targetGroupId, position: newPosition++ };
      }
      return item;
    }));
    setSelectedItems(new Set());

    // Update in database
    const updates = itemsToMove.map((itemId, index) => ({
      id: itemId,
      group_id: targetGroupId,
      position: targetGroupItems.length + index
    }));

    for (const update of updates) {
      const { error } = await supabase
        .from('items')
        .update({ group_id: update.group_id, position: update.position })
        .eq('id', update.id);
      if (error) {
        toast.error('Error moving items', { description: error.message });
        // Reload on error
        const { data } = await supabase
          .from('items')
          .select('id,board_id,name,position,group_id')
          .eq('board_id', boardId)
          .order('position', { ascending: true });
        if (data) setItems(data);
        return;
      }
    }

    toast.success('Items moved', { description: `${itemsToMove.length} item(s) moved successfully` });
  }

  // Mass set status
  function openStatusModal() {
    if (selectedItems.size === 0) return;

    // Find all status columns
    const statusColumns = columns.filter(c => c.type === 'status');
    if (statusColumns.length === 0) {
      toast.error('No status columns', { description: 'Create a status column first' });
      return;
    }

    // If only one status column, use it directly
    if (statusColumns.length === 1) {
      setStatusModalColumn(statusColumns[0]);
      setShowStatusModal(true);
    } else {
      // Multiple status columns - show column selection first
      // For now, just use the first one, but we could add a column selection modal
      setStatusModalColumn(statusColumns[0]);
      setShowStatusModal(true);
    }
  }

  async function handleMassSetStatus(targetStatus: string | null) {
    if (selectedItems.size === 0 || !statusModalColumn) return;
    setShowStatusModal(false);

    // Update all selected items
    const itemsToUpdate = Array.from(selectedItems);
    for (const itemId of itemsToUpdate) {
      await onUpdateCell(itemId, statusModalColumn.id, targetStatus);
    }
    setSelectedItems(new Set());
    const statusText = targetStatus === null ? 'Status...' : targetStatus;
    toast.success('Status updated', { description: `Status set to "${statusText}" for ${itemsToUpdate.length} item(s)` });
    setStatusModalColumn(null);
  }

  if (loading) return (
    <div className="space-y-2 p-4">
      <div className="h-10 w-full animate-pulse rounded bg-muted"></div>
      <div className="h-10 w-full animate-pulse rounded bg-muted"></div>
      <div className="h-10 w-full animate-pulse rounded bg-muted"></div>
    </div>
  );

  if (error) return <div className="p-4 text-destructive">Error: {error}</div>;

  const activeItem = activeId ? items.find((i) => i.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="p-4">
        <div className="mb-4 flex gap-2 items-center justify-between">
          <div className="flex gap-2 items-center">
            <button onClick={() => onAddItem(null)} className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 text-sm font-medium">
              + New Item
            </button>
            <button onClick={onAddGroup} className="rounded-md border border-input px-4 py-2 hover:bg-muted text-sm font-medium">
              + New Group
            </button>
            <button onClick={onAddColumn} className="rounded-md border border-input px-4 py-2 hover:bg-muted text-sm font-medium">
              + New Column
            </button>
            <div className="relative ml-2">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="rounded-md border border-input pl-9 pr-8 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-lg leading-none"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
            {searchQuery && (
              <span className="text-sm text-muted-foreground">
                {filteredItems.length} {filteredItems.length === 1 ? 'result' : 'results'}
              </span>
            )}
          </div>
          {showMassActions && (
            <div className="flex gap-2 items-center bg-primary/10 border border-primary/20 rounded-md px-4 py-2">
              <span className="text-sm font-medium text-primary">{selectedItems.size} selected</span>
              <div className="h-4 w-px bg-border mx-2"></div>
              <button
                onClick={openStatusModal}
                className="rounded-md border border-primary/30 bg-background px-3 py-1.5 text-sm hover:bg-muted"
              >
                Set Status
              </button>
              <button
                onClick={openGroupModal}
                className="rounded-md border border-primary/30 bg-background px-3 py-1.5 text-sm hover:bg-muted"
              >
                Move to Group
              </button>
              <button
                onClick={handleMassDelete}
                className="rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-sm hover:bg-destructive/10 text-destructive"
              >
                Delete
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="rounded-md px-3 py-1.5 text-sm hover:bg-muted text-muted-foreground"
                title="Clear selection"
              >
                ×
              </button>
            </div>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
          <table className="min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-background">
              <tr className="border-b border-border">
                <th className="sticky left-0 z-20 w-[40px] border-r border-border bg-background px-2 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={items.length > 0 && selectedItems.size === items.length}
                    onChange={handleSelectAll}
                    className="h-4 w-4 accent-primary cursor-pointer"
                    title="Select all"
                  />
                </th>
                <th className="sticky left-[40px] z-20 w-[250px] border-r border-border bg-background px-4 py-3 text-left font-medium text-muted-foreground">
                  Item
                </th>
                {columns.filter(col => !col.hidden).map((col) => (
                  <th
                    key={col.id}
                    className="border-r border-border px-4 py-3 text-left font-medium text-muted-foreground group relative resize-x overflow-auto"
                    style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
                  >
                    <div className="flex items-center justify-between">
                      {editingColumnId === col.id ? (
                        <input
                          className="w-full rounded border px-2 py-1 text-sm text-foreground"
                          autoFocus
                          value={editingColumnName}
                          onChange={(e) => setEditingColumnName(e.target.value)}
                          onBlur={() => onRenameColumn(col.id, editingColumnName)}
                          onKeyDown={(e) => e.key === 'Enter' && onRenameColumn(col.id, editingColumnName)}
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-primary"
                          onClick={() => {
                            setEditingColumnId(col.id);
                            setEditingColumnName(col.name);
                          }}
                        >
                          {col.name}
                        </span>
                      )}
                    </div>
                    <div className="absolute right-1 top-1 hidden group-hover:flex gap-1 bg-background p-1 shadow-sm rounded border border-border">
                      <select
                        className="text-xs border rounded px-1"
                        value={col.type}
                        onChange={(e) => onChangeColumnType(col.id, e.target.value as any)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="text">Text</option>
                        <option value="status">Status</option>
                        <option value="number">Number</option>
                        <option value="money">Money</option>
                        <option value="date">Date</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                      {col.type === 'status' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenStatusEditor(col.id);
                          }}
                          className="hover:bg-muted rounded px-1 text-xs"
                          title="Edit status options"
                        >
                          ⚙️
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleColumnVisibility(col.id);
                        }}
                        className="hover:bg-muted rounded px-1 text-xs"
                        title="Hide column"
                      >
                        👁️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteColumn(col.id);
                        }}
                        className="text-destructive hover:bg-destructive/10 rounded px-1 text-xs"
                        title="Delete column"
                      >
                        ×
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && groups.length === 0 ? (
                <tr>
                  <td colSpan={columns.filter(c => !c.hidden).length + 1} className="p-8 text-center">
                    <EmptyState
                      title="This board is empty"
                      description="Start by adding your first item or group above."
                    />
                  </td>
                </tr>
              ) : (
                <>
                  {/* Render groups */}
                  {groups.map((group) => (
                    <React.Fragment key={group.id}>
                      <GroupHeader
                        group={group}
                        itemCount={groupedItems[group.id]?.length || 0}
                        onToggleCollapse={() => onToggleGroupCollapse(group.id)}
                        onRename={(name) => onRenameGroup(group.id, name)}
                        onDelete={() => onDeleteGroup(group.id)}
                        onAddItem={() => onAddItem(group.id)}
                        onUpdateColor={(color) => onUpdateGroupColor(group.id, color)}
                        isEditing={editingGroupId === group.id}
                        editingName={editingGroupName}
                        setEditingName={setEditingGroupName}
                        startEditing={() => {
                          setEditingGroupId(group.id);
                          setEditingGroupName(group.name);
                        }}
                        isColorPickerOpen={editingGroupColorId === group.id}
                        onToggleColorPicker={() => {
                          setEditingGroupColorId(editingGroupColorId === group.id ? null : group.id);
                        }}
                        columnCount={columns.filter(c => !c.hidden).length + 1}
                        groupItems={groupedItems[group.id] || []}
                        selectedItems={selectedItems}
                        onSelectAllInGroup={() => {
                          const groupItemIds = new Set((groupedItems[group.id] || []).map(i => i.id));
                          const allSelected = Array.from(groupItemIds).every(id => selectedItems.has(id));
                          const newSelected = new Set(selectedItems);
                          if (allSelected) {
                            groupItemIds.forEach(id => newSelected.delete(id));
                          } else {
                            groupItemIds.forEach(id => newSelected.add(id));
                          }
                          setSelectedItems(newSelected);
                        }}
                      />
                      {!group.collapsed && (
                        <SortableContext
                          items={groupedItems[group.id]?.map((i) => i.id) || []}
                          strategy={verticalListSortingStrategy}
                        >
                          {groupedItems[group.id]?.map((item) => (
                            <SortableItemRow
                              key={item.id}
                              item={item}
                              columns={columns.filter(c => !c.hidden)}
                              cellValues={cellValues}
                              onRenameItem={onRenameItem}
                              onUpdateCell={onUpdateCell}
                              boardId={boardId}
                              workspaceId={workspaceId}
                              isSelected={selectedItems.has(item.id)}
                              onToggleSelect={() => handleToggleItem(item.id)}
                              onDeleteItem={onDeleteItem}
                            />
                          ))}
                        </SortableContext>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Render ungrouped items */}
                  {groupedItems['null'] && groupedItems['null'].length > 0 && (
                    <>
                      <tr className="bg-muted/30">
                        <td
                          colSpan={columns.filter(c => !c.hidden).length + 2}
                          className="px-4 py-2 font-medium text-muted-foreground border-b border-border"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={groupedItems['null'].length > 0 && groupedItems['null'].every(item => selectedItems.has(item.id))}
                                onChange={() => {
                                  const noGroupItemIds = new Set(groupedItems['null'].map(i => i.id));
                                  const allSelected = Array.from(noGroupItemIds).every(id => selectedItems.has(id));
                                  const newSelected = new Set(selectedItems);
                                  if (allSelected) {
                                    noGroupItemIds.forEach(id => newSelected.delete(id));
                                  } else {
                                    noGroupItemIds.forEach(id => newSelected.add(id));
                                  }
                                  setSelectedItems(newSelected);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="h-4 w-4 accent-primary cursor-pointer"
                                title="Select all in No Group"
                              />
                              <span className="text-sm">No Group ({groupedItems['null'].length})</span>
                            </div>
                            <button
                              onClick={() => onAddItem(null)}
                              className="text-xs px-2 py-1 rounded hover:bg-muted"
                            >
                              + Add Item
                            </button>
                          </div>
                        </td>
                      </tr>
                      <SortableContext
                        items={groupedItems['null'].map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {groupedItems['null'].map((item) => (
                          <SortableItemRow
                            key={item.id}
                            item={item}
                            columns={columns.filter(c => !c.hidden)}
                            cellValues={cellValues}
                            onRenameItem={onRenameItem}
                            onUpdateCell={onUpdateCell}
                            boardId={boardId}
                            workspaceId={workspaceId}
                            onDeleteItem={onDeleteItem}
                            isSelected={selectedItems.has(item.id)}
                            onToggleSelect={() => handleToggleItem(item.id)}
                          />
                        ))}
                      </SortableContext>
                    </>
                  )}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="bg-surface border border-border rounded px-4 py-2 shadow-lg opacity-90">
            {activeItem.name}
          </div>
        ) : null}
      </DragOverlay>

      <StatusEditor
        isOpen={editingStatusColumnId !== null}
        onClose={() => {
          setEditingStatusColumnId(null);
          setStatusOptions([]);
        }}
        initialOptions={statusOptions}
        onSave={onSaveStatusOptions}
      />

      {/* Group Selection Modal */}
      {
        showGroupModal && (
          <GroupSelectionModal
            groups={groups}
            selectedCount={selectedItems.size}
            onSelect={(groupId) => handleMassMoveToGroup(groupId)}
            onClose={() => setShowGroupModal(false)}
          />
        )
      }

      {/* Status Selection Modal */}
      {
        showStatusModal && statusModalColumn && (
          <StatusSelectionModal
            column={statusModalColumn}
            selectedCount={selectedItems.size}
            onSelect={(status) => handleMassSetStatus(status)}
            onClose={() => {
              setShowStatusModal(false);
              setStatusModalColumn(null);
            }}
          />
        )
      }
    </DndContext >
  );
}

const PRESET_COLORS = [
  '#00c875', // Green
  '#fdab3d', // Orange
  '#e2445c', // Red
  '#0073ea', // Blue
  '#a25ddc', // Purple
  '#784bd1', // Dark Purple
  '#ff642e', // Coral
  '#ffcb00', // Yellow
  '#808080', // Grey
  '#333333', // Black
];

function GroupHeader({
  group,
  itemCount,
  onToggleCollapse,
  onRename,
  onDelete,
  onAddItem,
  onUpdateColor,
  isEditing,
  editingName,
  setEditingName,
  startEditing,
  isColorPickerOpen,
  onToggleColorPicker,
  columnCount,
  groupItems,
  selectedItems,
  onSelectAllInGroup,
}: {
  group: Group;
  itemCount: number;
  onToggleCollapse: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onAddItem: () => void;
  onUpdateColor: (color: string) => void;
  isEditing: boolean;
  editingName: string;
  setEditingName: (name: string) => void;
  startEditing: () => void;
  isColorPickerOpen: boolean;
  onToggleColorPicker: () => void;
  columnCount: number;
  groupItems: Item[];
  selectedItems: Set<string>;
  onSelectAllInGroup: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: group.id,
  });

  const colorButtonRef = React.useRef<HTMLButtonElement>(null);
  const colorPickerRef = React.useRef<HTMLDivElement>(null);
  const [pickerPosition, setPickerPosition] = React.useState<{ top: number; left: number } | null>(null);

  // Calculate picker position and handle click outside
  React.useEffect(() => {
    if (!isColorPickerOpen || !colorButtonRef.current) {
      setPickerPosition(null);
      return;
    }

    const updatePosition = () => {
      if (!colorButtonRef.current) return;
      const rect = colorButtonRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        colorButtonRef.current &&
        !colorButtonRef.current.contains(target) &&
        colorPickerRef.current &&
        !colorPickerRef.current.contains(target)
      ) {
        onToggleColorPicker();
      }
    };

    // Delay to avoid immediate closing
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('mousedown', handleClickOutside);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isColorPickerOpen]);

  return (
    <tr
      ref={setNodeRef}
      className="bg-muted/50 hover:bg-muted/70 transition-colors group"
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <td
        colSpan={columnCount + 1}
        className="px-4 py-2 font-medium border-b border-border"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {groupItems.length > 0 && (
              <input
                type="checkbox"
                checked={groupItems.length > 0 && groupItems.every(item => selectedItems.has(item.id))}
                onChange={onSelectAllInGroup}
                onClick={(e) => e.stopPropagation()}
                className="h-4 w-4 accent-primary cursor-pointer"
                title="Select all in group"
              />
            )}
            <button
              onClick={onToggleCollapse}
              className="text-muted-foreground hover:text-foreground"
            >
              {group.collapsed ? '▶' : '▼'}
            </button>
            <div className="relative">
              <button
                ref={colorButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onToggleColorPicker();
                }}
                className="w-4 h-4 rounded border-2 border-white shadow-sm hover:scale-110 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                style={{ backgroundColor: group.color || '#0073ea' }}
                title="Change color"
              />
              {isColorPickerOpen && pickerPosition && typeof window !== 'undefined' && createPortal(
                <div
                  ref={colorPickerRef}
                  className="fixed z-[9999] grid grid-cols-5 gap-1 p-2 bg-white shadow-xl rounded-md border border-border"
                  style={{
                    top: `${pickerPosition.top}px`,
                    left: `${pickerPosition.left}px`,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className="w-6 h-6 rounded border-2 border-transparent hover:border-gray-400 hover:scale-110 transition-transform cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
                      style={{ backgroundColor: color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onUpdateColor(color);
                        onToggleColorPicker();
                      }}
                      title={color}
                    />
                  ))}
                </div>,
                document.body
              )}
            </div>
            {isEditing ? (
              <input
                className="px-2 py-1 text-sm border rounded"
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => onRename(editingName)}
                onKeyDown={(e) => e.key === 'Enter' && onRename(editingName)}
              />
            ) : (
              <span
                className="cursor-pointer hover:text-primary"
                onClick={startEditing}
                {...attributes}
                {...listeners}
              >
                {group.name} ({itemCount})
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onAddItem}
              className="text-xs px-2 py-1 rounded hover:bg-muted"
            >
              + Add Item
            </button>
            <button
              onClick={onDelete}
              className="text-xs px-2 py-1 rounded hover:bg-destructive/10 text-destructive"
            >
              Delete Group
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}

function SortableItemRow({
  item,
  columns,
  cellValues,
  onRenameItem,
  onUpdateCell,
  boardId,
  workspaceId,
  onDeleteItem,
  isSelected,
  onToggleSelect,
}: {
  item: Item;
  columns: Column[];
  cellValues: Record<string, Record<string, any>>;
  onRenameItem: (id: string, name: string) => void;
  onUpdateCell: (itemId: string, columnId: string, value: any) => void;
  boardId: string;
  workspaceId: string;
  onDeleteItem: (id: string) => void;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`group border-b border-border hover:bg-muted/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}
    >
      <td className="sticky left-0 z-10 border-r border-border bg-surface group-hover:bg-muted/30 px-2 py-2 text-center">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 accent-primary cursor-pointer"
        />
      </td>
      <td className="sticky left-[40px] z-10 border-r border-border bg-surface group-hover:bg-muted/30 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            <span
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
              {...attributes}
              {...listeners}
            >
              ⋮⋮
            </span>
            <InlineName name={item.name} onChange={(v) => onRenameItem(item.id, v)} />
          </div>
          <div className="flex gap-1">
            <Link
              href={`/w/${workspaceId}/b/${boardId}/${item.id}`}
              className="hidden text-muted-foreground hover:text-primary group-hover:flex text-lg transition-colors items-center justify-center w-6 h-6"
              title="View item details"
            >
              👁️
            </Link>
            <button
              onClick={() => {
                if (confirm('Delete this item?')) {
                  onDeleteItem(item.id);
                }
              }}
              className="hidden text-muted-foreground hover:text-destructive group-hover:flex text-sm transition-colors items-center justify-center w-6 h-6 rounded hover:bg-destructive/10"
              title="Delete item"
            >
              🗑️
            </button>
          </div>
        </div>
      </td>
      {columns.map((col) => (
        <td
          key={col.id}
          className="border-r border-border px-4 py-2"
          style={{ width: `${col.width}px`, minWidth: `${col.width}px` }}
        >
          <CellEditor
            column={col}
            value={cellValues[item.id]?.[col.id]}
            onChange={(v) => onUpdateCell(item.id, col.id, v)}
          />
        </td>
      ))}
    </tr>
  );
}

function InlineName(props: { name: string; onChange: (v: string) => void }) {
  const [val, setVal] = useState(props.name);
  useEffect(() => setVal(props.name), [props.name]);
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => props.onChange(val)}
      className="w-full bg-transparent px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary rounded-sm text-sm"
    />
  );
}

function CellEditor(props: {
  column: Column;
  value: any;
  onChange: (v: any) => void;
}) {
  const { column, value, onChange } = props;

  if (column.type === 'status') {
    // Get status options from column config, with fallback to defaults
    const statusOptions: Array<{ label: string; color: string }> =
      column.config?.status_options || [
        { label: 'Done', color: '#00c875' },
        { label: 'Working on it', color: '#fdab3d' },
        { label: 'Stuck', color: '#e2445c' }
      ];

    // Find the color for the current value
    const currentOption = statusOptions.find(opt => opt.label === value);
    const bg = currentOption?.color || '#c4c4c4';
    const displayValue = value as string || '';

    return (
      <div className="relative">
        <select
          className="w-full rounded px-2 py-1 text-center text-white text-xs font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
          style={{ backgroundColor: bg }}
          value={displayValue}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" style={{ backgroundColor: '#c4c4c4' }}>Status...</option>
          {statusOptions.map((opt) => (
            <option
              key={opt.label}
              value={opt.label}
              style={{ backgroundColor: opt.color }}
            >
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (column.type === 'text' || column.type === 'long_text') {
    return (
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent px-2 py-1 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary rounded"
      />
    );
  }

  if (column.type === 'number') {
    return (
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        className="w-full bg-transparent px-2 py-1 text-sm text-right focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary rounded"
      />
    );
  }

  if (column.type === 'money') {
    const [displayValue, setDisplayValue] = React.useState<string>('');
    const [isFocused, setIsFocused] = React.useState(false);

    React.useEffect(() => {
      if (!isFocused && value !== null && value !== undefined && value !== '') {
        const num = typeof value === 'number' ? value : parseFloat(String(value));
        if (!isNaN(num)) {
          setDisplayValue(new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'EUR'
          }).format(num));
        } else {
          setDisplayValue('');
        }
      } else {
        setDisplayValue(value?.toString() ?? '');
      }
    }, [value, isFocused]);

    return (
      <input
        type="text"
        value={isFocused ? (value?.toString() ?? '') : displayValue}
        onChange={(e) => {
          const inputValue = e.target.value;
          if (inputValue === '') {
            onChange(null);
          } else {
            // Allow typing numbers and decimal point
            const num = parseFloat(inputValue);
            onChange(isNaN(num) ? null : num);
          }
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="w-full bg-transparent px-2 py-1 text-sm text-right focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary rounded"
      />
    );
  }

  if (column.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary cursor-pointer"
      />
    );
  }

  if (column.type === 'date') {
    return (
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent px-2 py-1 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary rounded"
      />
    );
  }

  if (column.type === 'email') {
    return (
      <input
        type="email"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent px-2 py-1 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary rounded"
      />
    );
  }

  if (column.type === 'phone') {
    return (
      <input
        type="tel"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent px-2 py-1 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary rounded"
      />
    );
  }

  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent px-2 py-1 text-sm focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary rounded"
    />
  );
}

// Group Selection Modal
function GroupSelectionModal({
  groups,
  selectedCount,
  onSelect,
  onClose,
}: {
  groups: Group[];
  selectedCount: number;
  onSelect: (groupId: string | null) => void;
  onClose: () => void;
}) {
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null | undefined>(null);

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (typeof window === 'undefined') return null;

  return createPortal((
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-xl border border-border w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Move {selectedCount} item(s) to group</h2>
          <p className="text-sm text-muted-foreground mt-1">Select a destination group</p>
        </div>
        <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-2">
            <button
              onClick={() => setSelectedGroupId(null)}
                className={`w-full text-left px-4 py-3 rounded-md border-2 transition-colors ${
                  selectedGroupId === null
                ? 'border-primary bg-primary/10'
                : 'border-border hover:bg-muted'
                }`}
            >
              <div className="font-medium">No Group</div>
              <div className="text-xs text-muted-foreground mt-1">Move items out of all groups</div>
            </button>
            {groups.map((group) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroupId(group.id)}
                  className={`w-full text-left px-4 py-3 rounded-md border-2 transition-colors ${
                    selectedGroupId === group.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded border border-white shadow-sm"
                    style={{ backgroundColor: group.color || '#0073ea' }}
                  />
                  <div className="font-medium">{group.name}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border hover:bg-muted text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (selectedGroupId !== undefined) {
                onSelect(selectedGroupId);
              }
            }}
            disabled={selectedGroupId === undefined}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Move
          </button>
        </div>
      </div>
      </div>
    ),
    document.body
  );
}

// Status Selection Modal
function StatusSelectionModal({
  column,
  selectedCount,
  onSelect,
  onClose,
}: {
  column: Column;
  selectedCount: number;
  onSelect: (status: string | null) => void;
  onClose: () => void;
}) {
  const [selectedStatus, setSelectedStatus] = React.useState<string | null | undefined>(undefined);

  const statusOptions: Array<{ label: string; color: string }> =
    column.config?.status_options || [
      { label: 'Done', color: '#00c875' },
      { label: 'Working on it', color: '#fdab3d' },
      { label: 'Stuck', color: '#e2445c' }
    ];
  
  // Add default "Status..." option (null/empty status)
  // Use a special symbol to represent null status selection
  const STATUS_NULL = '__NULL__';
  const allOptions = [
    { label: 'Status...', color: '#9ca3af', value: STATUS_NULL },
    ...statusOptions.map(opt => ({ ...opt, value: opt.label }))
  ];

  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (typeof window === 'undefined') return null;

  return createPortal((
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background rounded-lg shadow-xl border border-border w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">Set status for {selectedCount} item(s)</h2>
          <p className="text-sm text-muted-foreground mt-1">Column: {column.name}</p>
        </div>
        <div className="px-6 py-4 max-h-[400px] overflow-y-auto">
          <div className="space-y-2">
            {allOptions.map((option) => (
              <button
                key={option.label}
                onClick={() => setSelectedStatus(option.value)}
                className={`w-full text-left px-4 py-3 rounded-md border-2 transition-colors ${
                  selectedStatus === option.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded border border-white shadow-sm"
                    style={{ backgroundColor: option.color }}
                  />
                  <div className="font-medium">{option.label}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-border hover:bg-muted text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              // Convert STATUS_NULL to null, otherwise pass the status string
              const statusToSet = selectedStatus === STATUS_NULL ? null : selectedStatus;
              onSelect(statusToSet);
            }}
            disabled={selectedStatus === undefined}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Set Status
          </button>
        </div>
      </div>
    </div>
  ),
    document.body
  );
}