import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const MODEL = 'qwen/qwen2.5-vl-3b-instruct';
const CONTACTS_BOARD_ID = 'eeb8bc91-f7ad-414e-966a-a7c287d9a6b0';
const PHONE_COLUMN_ID = 'b5f2fde4-cae9-4279-a849-9eadf704556e';
const EMAIL_COLUMN_ID = '51002f09-23e8-4188-bce3-1e2c0e14829f';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | { type: 'text'; text: string }[] | { type: 'text'; text: string } & { type: 'image_url'; image_url: { url: string } };
}

interface ChatRequest {
  messages: ChatMessage[];
  addContact?: boolean;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, addContact = false }: ChatRequest = await request.json();

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: 'Missing OPENROUTER_API_KEY' }, { status: 500 });
    }

    const systemPrompt = `You are a helpful contact extractor for ArtePay. Analyze screenshots/business cards/images to extract:
- name (full name of person/company)
- phone (Estonian format like +372xxxxxxxxx or 5xxxxxx)
- email

Respond conversationally, but always include exact extracted data as JSON block: 
{"name": "John Doe", "phone": "+372 123 4567", "email": "john@example.com"}

If no contact info, say so. For other questions, be helpful about managing contacts/board.

`;

    const formattedMessages = [
      { role: 'system', content: [{ type: 'text', text: systemPrompt }] },
      ...messages
    ];

    const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'X-Title': 'ArtePay Contacts AI',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: formattedMessages,
        temperature: 0.2,
        max_tokens: 400,
      }),
    });

    if (!openRouterRes.ok) {
      const error = await openRouterRes.json();
      return NextResponse.json({ error: error.message || 'OpenRouter error' }, { status: 500 });
    }

    const data = await openRouterRes.json();
    const assistantContent = data.choices[0].message.content;

    // Parse extracted contact JSON from response
    let extractedContact = null;
    const jsonMatch = assistantContent.match(/\{[^{}]*(name|phone|email)[^{}]*\}/);
    if (jsonMatch) {
      try {
        extractedContact = JSON.parse(jsonMatch[0]);
      } catch {}
    }

    const assistantMsg = {
      role: 'assistant' as const,
      content: assistantContent,
      extractedContact,
    };

    let addedItemId = null;
    if (addContact && extractedContact && extractedContact.name) {
      const supabase = createServerSupabase();

      // Get next position
      const { data: items } = await supabase
        .from('items')
        .select('position')
        .eq('board_id', CONTACTS_BOARD_ID)
        .order('position', { ascending: false })
        .limit(1);

      const nextPosition = items?.[0] ? items[0].position + 1 : 0;

      // Insert item
      const { data: newItem } = await supabase
        .from('items')
        .insert({
          board_id: CONTACTS_BOARD_ID,
          name: extractedContact.name,
          position: nextPosition,
        })
        .select('id')
        .single();

      if (newItem) {
        addedItemId = newItem.id;

        // Upsert phone
        if (extractedContact.phone) {
          await supabase.from('cell_values').upsert({
            item_id: newItem.id,
            column_id: PHONE_COLUMN_ID,
            value: { text: extractedContact.phone },
          });
        }

        // Upsert email
        if (extractedContact.email) {
          await supabase.from('cell_values').upsert({
            item_id: newItem.id,
            column_id: EMAIL_COLUMN_ID,
            value: { text: extractedContact.email },
          });
        }
      }
    }

    return NextResponse.json({
      messages: [...messages, assistantMsg],
      extractedContact,
      addedItemId,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
