import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = createServerSupabase();

  // Get recent automation logs with details
  const { data: logs, error } = await supabase
    .from('automation_logs')
    .select('*, automations(name, board_id, is_active, trigger_config, action_config)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs });
}
