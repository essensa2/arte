import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { BoardChatbot } from '@/components/chat/Chatbot';
import { BoardTable } from '@/components/board/BoardTable';

const CONTACTS_BOARD_ID = 'eeb8bc91-f7ad-414e-966a-a7c287d9a6b0';

export default async function ContactsPage() {
  const cookieStore = cookies();
  const supabase = createServerSupabase(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/sign-in');

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
            Contacts AI Assistant
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Upload screenshots of business cards, chat with AI powered by Qwen Vision, extract contacts, and add them directly to your Contacts board.
          </p>
        </header>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          {/* Chatbot */}
          <div>
            <BoardChatbot boardId={CONTACTS_BOARD_ID} />
          </div>

          {/* Board Preview */}
          <div className="bg-white rounded-2xl shadow-xl border p-6">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
              📋 Contacts Board (Live)
              <span className="text-sm text-green-500 font-medium">Auto-updates</span>
            </h2>
            <BoardTable boardId={CONTACTS_BOARD_ID} />
          </div>
        </div>
      </div>
    </main>
  );
}
