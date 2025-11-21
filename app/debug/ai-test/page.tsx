"use client";
import { useEffect, useState } from 'react';

export default function AITestPage() {
  const [boards, setBoards] = useState<any[]>([]);
  const [selectedBoard, setSelectedBoard] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [automations, setAutomations] = useState<any[]>([]);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetchBoards();
  }, []);

  useEffect(() => {
    if (selectedBoard) {
      fetchItems();
      fetchAutomations();
    }
  }, [selectedBoard]);

  async function fetchBoards() {
    // You'll need to implement this endpoint
    const res = await fetch('/api/boards');
    if (res.ok) {
      const data = await res.json();
      setBoards(data.boards || []);
    }
  }

  async function fetchItems() {
    const res = await fetch(`/api/boards/${selectedBoard}/items`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items || []);
    }
  }

  async function fetchAutomations() {
    const res = await fetch(`/api/boards/${selectedBoard}/automations`);
    if (res.ok) {
      const data = await res.json();
      setAutomations(data.automations || []);
    }
  }

  async function testAutomation() {
    if (!selectedBoard) {
      alert('Please select a board first');
      return;
    }

    setProcessing(true);
    setResult(null);

    try {
      const res = await fetch('/api/automation/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board_id: selectedBoard })
      });

      const data = await res.json();
      setResult(data);

      // Fetch updated items
      await fetchItems();
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">AI Automation Test Console</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Board Selection */}
        <div className="p-4 border rounded-lg">
          <label className="block text-sm font-medium mb-2">Select Board</label>
          <select
            value={selectedBoard}
            onChange={(e) => setSelectedBoard(e.target.value)}
            className="w-full rounded-md border px-3 py-2"
          >
            <option value="">Choose a board...</option>
            {boards.map((board) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>

          {selectedBoard && (
            <div className="mt-4">
              <div className="text-sm text-gray-600 mb-2">
                Active Automations: {automations.filter(a => a.is_active).length}
              </div>
              <button
                onClick={testAutomation}
                disabled={processing}
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
              >
                {processing ? 'Processing...' : 'Run Automations Now'}
              </button>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="p-4 border rounded-lg">
          <div className="text-sm font-medium mb-2">Result</div>
          {result ? (
            <pre className="p-3 bg-gray-100 rounded text-xs overflow-auto max-h-64">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <div className="text-sm text-gray-400">
              Click "Run Automations Now" to see results
            </div>
          )}
        </div>
      </div>

      {/* Items */}
      {selectedBoard && items.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Items on Board</h2>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="p-3 border rounded">
                <div className="font-medium">{item.name}</div>
                <div className="text-xs text-gray-500 mt-1">ID: {item.id}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Automations */}
      {selectedBoard && automations.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Automations</h2>
          <div className="space-y-4">
            {automations.map((auto) => (
              <div key={auto.id} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{auto.name}</div>
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      auto.is_active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {auto.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <details>
                  <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900">
                    View configuration
                  </summary>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(
                      {
                        trigger: auto.trigger_config,
                        actions: auto.action_config,
                      },
                      null,
                      2
                    )}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Link to logs */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <div className="font-medium mb-2">View Detailed Logs</div>
        <a
          href="/debug/logs"
          className="text-blue-600 hover:underline text-sm"
        >
          Go to Automation Logs →
        </a>
        <div className="text-xs text-gray-600 mt-1">
          See detailed success/error messages for each automation run
        </div>
      </div>
    </div>
  );
}
