"use client";
import { useEffect, useState } from 'react';

type DebugData = {
  columns: any[];
  automations: any[];
  events: any[];
  logs: any[];
  config: any[];
  errors: Record<string, string | undefined>;
};

export default function AutomationsDebugPage() {
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fixing, setFixing] = useState<string | null>(null);
  const [testingBoard, setTestingBoard] = useState<string | null>(null);

  useEffect(() => {
    fetchDebugData();
  }, []);

  async function fetchDebugData() {
    setLoading(true);
    const res = await fetch('/api/automation/debug');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  async function fixAutomation(automationId: string, columnId: string) {
    setFixing(automationId);
    const res = await fetch('/api/automation/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'fix_automation', automationId, columnId })
    });
    const result = await res.json();
    if (result.success) {
      alert('Automation fixed! Refreshing...');
      fetchDebugData();
    } else {
      alert('Error: ' + result.error);
    }
    setFixing(null);
  }

  async function testTrigger(boardId: string) {
    setTestingBoard(boardId);
    const res = await fetch('/api/automation/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'test_trigger', boardId })
    });
    const result = await res.json();
    alert(`Test result (${result.status}): ${JSON.stringify(result.data, null, 2)}`);
    fetchDebugData();
    setTestingBoard(null);
  }

  if (loading) {
    return <div className="p-8">Loading debug information...</div>;
  }

  if (!data) {
    return <div className="p-8">No data available</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Automation Debug Console</h1>

      {/* Errors */}
      {Object.entries(data.errors).some(([_, v]) => v) && (
        <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Errors</h2>
          {Object.entries(data.errors).map(([key, error]) =>
            error ? (
              <div key={key} className="text-sm text-red-600">
                {key}: {error}
              </div>
            ) : null
          )}
        </div>
      )}

      {/* App Config */}
      <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded">
        <h2 className="text-lg font-semibold mb-2">App Configuration</h2>
        <div className="space-y-1 text-sm font-mono">
          {data.config.map((c: any) => (
            <div key={c.key} className="flex gap-2">
              <span className="font-semibold">{c.key}:</span>
              <span className={c.value.includes('YOUR_') ? 'text-red-600' : 'text-green-600'}>
                {c.value.includes('YOUR_') ? '❌ NOT CONFIGURED' : '✓ Configured'}
              </span>
            </div>
          ))}
        </div>
        {data.config.some((c: any) => c.value.includes('YOUR_')) && (
          <p className="mt-2 text-sm text-red-600">
            ⚠️ Webhook configuration is not set up! Run the fix-automations.sql script in Supabase SQL Editor.
          </p>
        )}
      </div>

      {/* Status Columns */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Status Columns</h2>
        <div className="bg-white border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Board</th>
                <th className="px-4 py-2 text-left">Column Name</th>
                <th className="px-4 py-2 text-left font-mono text-xs">Column ID</th>
              </tr>
            </thead>
            <tbody>
              {data.columns.map((col: any) => (
                <tr key={col.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{col.boards?.name}</td>
                  <td className="px-4 py-2 font-medium">{col.name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-600">{col.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Automations */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Automations</h2>
        <div className="space-y-4">
          {data.automations.map((auto: any) => {
            const columnId = auto.trigger_config?.column_id;
            const column = data.columns.find((c: any) => c.id === columnId);
            const isColumnMissing = columnId && !column;

            return (
              <div
                key={auto.id}
                className={`p-4 border rounded ${isColumnMissing ? 'bg-red-50 border-red-300' : 'bg-white'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-semibold">{auto.name}</div>
                    <div className="text-sm text-gray-600">Board: {auto.boards?.name}</div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`px-2 py-1 rounded text-xs ${auto.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {auto.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => testTrigger(auto.board_id)}
                      disabled={testingBoard === auto.board_id}
                      className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                    >
                      {testingBoard === auto.board_id ? 'Testing...' : 'Test Now'}
                    </button>
                  </div>
                </div>

                <div className="text-sm space-y-1">
                  <div className="flex gap-2">
                    <span className="text-gray-500">Trigger Column:</span>
                    {isColumnMissing ? (
                      <span className="text-red-600 font-medium">
                        ❌ Column not found (ID: {columnId})
                      </span>
                    ) : column ? (
                      <span className="text-green-600">✓ {column.name}</span>
                    ) : (
                      <span className="text-gray-400">Not configured</span>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <span className="text-gray-500">Target Status:</span>
                    <span className="font-mono text-xs">
                      {auto.trigger_config?.target_status || 'Any'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <span className="text-gray-500">Action:</span>
                    <span>{auto.action_type}</span>
                  </div>
                </div>

                {isColumnMissing && (
                  <div className="mt-3 p-3 bg-white border border-red-200 rounded">
                    <div className="text-sm font-medium text-red-800 mb-2">
                      Fix Required: Column Missing
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      Select the correct status column for this automation:
                    </div>
                    <div className="flex gap-2">
                      {data.columns
                        .filter((c: any) => c.board_id === auto.board_id)
                        .map((c: any) => (
                          <button
                            key={c.id}
                            onClick={() => fixAutomation(auto.id, c.id)}
                            disabled={fixing === auto.id}
                            className="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                          >
                            {fixing === auto.id ? 'Fixing...' : `Use "${c.name}"`}
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Events */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Automation Events</h2>
        <div className="bg-white border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Column</th>
                <th className="px-4 py-2 text-left">Old Value</th>
                <th className="px-4 py-2 text-left">New Value</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.events.map((evt: any) => (
                <tr key={evt.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{evt.columns?.name || 'Unknown'}</td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {evt.old_value ? JSON.stringify(evt.old_value) : '-'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {evt.new_value ? JSON.stringify(evt.new_value) : '-'}
                  </td>
                  <td className="px-4 py-2">
                    {evt.processed_at ? (
                      <span className="text-green-600">✓ Processed</span>
                    ) : (
                      <span className="text-orange-600">⏳ Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {new Date(evt.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No events recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Logs */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Automation Logs</h2>
        <div className="bg-white border rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-2 text-left">Automation</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Message</th>
                <th className="px-4 py-2 text-left">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((log: any) => (
                <tr key={log.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{log.automations?.name || 'Unknown'}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${
                      log.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">{log.message}</td>
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {new Date(log.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.logs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    No logs recorded yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <button
        onClick={fetchDebugData}
        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
      >
        Refresh Data
      </button>
    </div>
  );
}
