import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/client'; // Import to resolve TypeScript error

export async function GET(request: Request) {
  const supabase = createServerSupabase();

  // Get all status columns
  const { data: columns, error: columnsError } = await supabase
    .from('columns')
    .select('id, name, board_id, type, boards(name)')
    .eq('type', 'status');

  // Get all automations
  const { data: automations, error: automationsError } = await supabase
    .from('automations')
    .select('*, boards(name)')
    .eq('trigger_type', 'STATUS_CHANGED');

  // Get recent automation events
  const { data: events, error: eventsError } = await supabase
    .from('automation_events')
    .select('*, columns(name)')
    .order('created_at', { ascending: false })
    .limit(10);

  // Get automation logs
  const { data: logs, error: logsError } = await supabase
    .from('automation_logs')
    .select('*, automations(name)')
    .order('created_at', { ascending: false })
    .limit(10);

  // Check app_config
  const { data: config, error: configError } = await supabase
    .from('app_config')
    .select('*');

  return NextResponse.json({
    columns: columns || [],
    automations: automations || [],
    events: events || [],
    logs: logs || [],
    config: config || [],
    errors: {
      columns: columnsError?.message,
      automations: automationsError?.message,
      events: eventsError?.message,
      logs: logsError?.message,
      config: configError?.message
    }
  });
}

export async function POST(request: Request) {
  const supabase = createServerSupabase(); // Using createServerSupabase for server-side
  const body = await request.json();

  if (body.action === 'fix_automation') {
    // Update automation with correct column_id
    const { automationId, columnId } = body;

    const { data: automation } = await supabase
      .from('automations')
      .select('*')
      .eq('id', automationId)
      .single();

    if (!automation) {
      return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('automations')
      .update({
        trigger_config: {
          ...automation.trigger_config,
          column_id: columnId
        }
      })
      .eq('id', automationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  if (body.action === 'test_trigger') {
    // Manually trigger automation processing
    const { boardId } = body;

    const functionsUrl = process.env.SUPABASE_FUNCTIONS_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!functionsUrl || !serviceKey) {
      return NextResponse.json({ error: 'Missing configuration' }, { status: 500 });
    }

    const res = await fetch(`${functionsUrl}/automation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`
      },
      body: JSON.stringify({ board_id: boardId })
    });

    const data = await res.text();

    return NextResponse.json({
      status: res.status,
      data: data
    });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
