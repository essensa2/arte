"use client";
import { useEffect, useState } from 'react';

export default function AutomationLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  async function fetchLogs() {
    setLoading(true);
    const res = await fetch('/api/automation/logs');
    const data = await res.json();
    setLogs(data.logs || []);
    setLoading(false);
  }

  if (loading) {
    return <div className="p-8">Loading logs...</div>;
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Automation Logs</h1>
        <button
          onClick={fetchLogs}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
        >
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {logs.map((log: any) => (
          <div
            key={log.id}
            className={`p-4 border rounded-lg ${
              log.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      log.status === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {log.status}
                  </span>
                  <span className="font-medium">{log.automations?.name || 'Unknown'}</span>
                </div>
                <div className="text-sm text-gray-700 mb-2">{log.message}</div>
                <div className="text-xs text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                </div>
              </div>
            </div>

            {log.automations && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900">
                  View automation config
                </summary>
                <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
                  {JSON.stringify(
                    {
                      is_active: log.automations.is_active,
                      trigger_config: log.automations.trigger_config,
                      action_config: log.automations.action_config,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            )}
          </div>
        ))}

        {logs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No automation logs found. Try triggering an automation first.
          </div>
        )}
      </div>
    </div>
  );
}
