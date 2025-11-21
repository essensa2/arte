'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

// Types (copied/adapted from BoardTable)
type Column = {
  id: string;
  name: string;
  type: string;
  hidden?: boolean;
  config?: any;
};

type Item = {
  id: string;
  name: string;
  board_id: string;
  position: number;
  group_id?: string | null;
  due_date?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string;
};

type AutomationEvent = {
  id: string;
  created_at: string;
  processed_at?: string;
  column_id: string;
  old_value: any;
  new_value: any;
  columns: {
    name: string;
  };
};

type Group = {
  name: string;
};

export default function ItemPage() {
  const params = useParams<{ workspaceId: string; boardId: string; itemId: string }>();
  const router = useRouter();
  const supabase = createClient();

  const [item, setItem] = useState<Item | null>(null);
  const [boardName, setBoardName] = useState('');
  const [columns, setColumns] = useState<Column[]>([]);
  const [cellValues, setCellValues] = useState<Record<string, any>>({});
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [events, setEvents] = useState<AutomationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadItem() {
      setLoading(true);
      setError(null);

      try {
        // Fetch item
        const { data: itemData } = await supabase
          .from('items')
          .select('*')
          .eq('id', params.itemId)
          .single();

        if (!itemData) {
          setError('Item not found');
          return;
        }
        setItem(itemData);

        // Fetch board name
        const { data: boardData } = await supabase
          .from('boards')
          .select('name')
          .eq('id', itemData.board_id)
          .single();
        setBoardName(boardData?.name || '');

        // Fetch all columns
        const { data: colsData } = await supabase
          .from('columns')
          .select('*')
          .eq('board_id', itemData.board_id)
          .order('position');
        setColumns(colsData || []);

        // Fetch cell values
        const { data: cvData } = await supabase
          .from('cell_values')
          .select('column_id, value')
          .eq('item_id', params.itemId);
        const cvMap: Record<string, any> = {};
        cvData?.forEach((cv) => {
          cvMap[cv.column_id] = cv.value;
        });
        setCellValues(cvMap);

        // Fetch current group
        if (itemData.group_id) {
          const { data: groupData } = await supabase
            .from('groups')
            .select('name')
            .eq('id', itemData.group_id)
            .single();
          setCurrentGroup(groupData || null);
        }

        // Fetch change events
        const { data: eventsData } = await supabase
          .from('automation_events')
          .select('*, columns:name')
          .eq('item_id', params.itemId)
          .order('created_at', { ascending: false })
          .limit(50);
        setEvents(eventsData || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (params.itemId && params.boardId) {
      loadItem();
    }
  }, [params.itemId, params.boardId, supabase]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (error || !item) {
    return <div className="p-6 text-destructive">Error: {error || 'Item not found'}</div>;
  }

  const formatValue = (value: any, type?: string): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') {
      if (type === 'money') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
      }
      return value.toString();
    }
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/w/${params.workspaceId}/b/${params.boardId}`}>
              ← Back to {boardName}
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={async () => {
              if (confirm('Delete this item permanently?')) {
                const { error } = await supabase.from('items').delete().eq('id', params.itemId);
                if (error) {
                  alert('Delete failed: ' + error.message);
                } else {
                  router.push(`/w/${params.workspaceId}/b/${params.boardId}`);
                }
              }
            }}
            size="sm"
          >
            Delete Item
          </Button>
        </div>
        <h1 className="text-3xl font-bold">{item.name}</h1>
      </div>

      <div className="space-y-6">
        {/* Contact Info Hero */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Info</CardTitle>
            <CardDescription>Key details and currency values</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {currentGroup && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Group</p>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {currentGroup.name}
                </Badge>
              </div>
            )}
            {item.due_date && (
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Due Date</p>
                <p className="text-lg font-semibold">{new Date(item.due_date).toLocaleDateString()}</p>
              </div>
            )}
            {/* Status */}
            {(() => {
              const statusCol = columns.find(c => c.type === 'status');
              const statusValue = statusCol ? cellValues[statusCol.id] : null;
              const statusOption = statusCol?.config?.status_options?.find((opt: any) => opt.label === statusValue);
              return statusValue ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  <Badge 
                    className="text-base px-4 py-2" 
                    style={{ backgroundColor: statusOption?.color || '#c4c4c4' }}
                  >
                    {statusValue}
                  </Badge>
                </div>
              ) : null;
            })()}
            {/* Email */}
            {(() => {
              const emailCol = columns.find(c => c.type === 'email');
              const email = emailCol ? cellValues[emailCol.id] : null;
              return email ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Email</p>
                  <div className="text-lg font-mono bg-muted/50 px-3 py-2 rounded-md">{email}</div>
                </div>
              ) : null;
            })()}
            {/* Phone */}
            {(() => {
              const phoneCol = columns.find(c => c.type === 'phone');
              const phone = phoneCol ? cellValues[phoneCol.id] : null;
              return phone ? (
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Phone</p>
                  <div className="text-lg font-mono bg-muted/50 px-3 py-2 rounded-md">{phone}</div>
                </div>
              ) : null;
            })()}
            {/* Money columns - prioritize OKT25 */}
            {(() => {
              const moneyCols = columns
                .filter(c => c.type === 'money')
                .sort((a, b) => (a.name === 'OKT25' ? -1 : b.name === 'OKT25' ? 1 : 0));
              return moneyCols.slice(0, 3).map(col => {
                const value = cellValues[col.id];
                if (!value) return null;
                return (
                  <div key={col.id}>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{col.name}</p>
                    <div className="text-2xl font-bold text-primary">
                      {formatValue(value, 'money')}
                    </div>
                  </div>
                );
              });
            })()}
          </CardContent>
        </Card>

        {/* All Properties */}
        <Card>
          <CardHeader>
            <CardTitle>All Properties</CardTitle>
            <CardDescription>Every field including hidden columns</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell><strong>Name</strong></TableCell>
                  <TableCell>{item.name}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Position</strong></TableCell>
                  <TableCell>{item.position}</TableCell>
                </TableRow>
                {currentGroup && (
                  <TableRow>
                    <TableCell><strong>Group</strong></TableCell>
                    <TableCell>{currentGroup.name}</TableCell>
                  </TableRow>
                )}
                {item.due_date && (
                  <TableRow>
                    <TableCell><strong>Due Date</strong></TableCell>
                    <TableCell>{new Date(item.due_date).toLocaleDateString()}</TableCell>
                  </TableRow>
                )}
                {item.archived_at && (
                  <TableRow>
                    <TableCell><strong>Archived</strong></TableCell>
                    <TableCell>{new Date(item.archived_at).toLocaleString()}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell><strong>Created</strong></TableCell>
                  <TableCell>{new Date(item.created_at).toLocaleString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><strong>Last Updated</strong></TableCell>
                  <TableCell>{new Date(item.updated_at).toLocaleString()}</TableCell>
                </TableRow>
                {columns.map((col) => (
                  <TableRow key={col.id}>
                    <TableCell>
                      {col.name}
                      {col.hidden && <Badge variant="secondary" className="ml-2">Hidden on board</Badge>}
                    </TableCell>
                    <TableCell>{formatValue(cellValues[col.id], col.type)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Change History */}
        <Card>
          <CardHeader>
            <CardTitle>Change History</CardTitle>
            <CardDescription>Cell changes and automation events (most recent first)</CardDescription>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No changes recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Column</TableHead>
                    <TableHead>Old Value</TableHead>
                    <TableHead>New Value</TableHead>
                    <TableHead>Processed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                      <TableCell>{event.columns?.name || event.column_id}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{formatValue(event.old_value)}</TableCell>
                      <TableCell className="max-w-[200px] truncate font-medium">{formatValue(event.new_value)}</TableCell>
                      <TableCell>
                        {event.processed_at ? (
                          <Badge variant="default">{new Date(event.processed_at).toLocaleString()}</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
