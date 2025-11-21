import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-dvh p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to ArtePay Boards</h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl">
            A powerful board and table management system with automations.
            Create workspaces, organize your boards, and automate your workflows.
          </p>
          <div className="flex gap-4">
            <Link
              href="/sign-in"
              className="rounded-md bg-primary px-6 py-3 text-primary-foreground hover:opacity-90 font-medium"
            >
              Get Started
            </Link>
            <Link
              href="/workspaces"
              className="rounded-md border px-6 py-3 hover:bg-muted font-medium"
            >
              View Workspaces
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}


