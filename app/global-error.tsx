'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-6">
          <h2 className="text-2xl font-semibold mb-4">Something went wrong!</h2>
          <p className="mb-4">{error.message}</p>
          <button
            onClick={reset}
            className="rounded-md px-4 py-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

