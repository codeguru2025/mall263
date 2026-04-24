'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  const isProd = process.env.NODE_ENV === 'production';

  useEffect(() => {
    console.error('[GlobalError]', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border-2 border-gray-100 p-8 max-w-sm w-full text-center space-y-4">
        <p className="text-4xl">⚠️</p>
        <h2 className="text-xl font-black text-navy-700">Something went wrong</h2>
        <p className="text-sm text-gray-500">
          {isProd
            ? 'An unexpected error occurred. Please try again.'
            : error?.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => reset()}
            className="btn-primary text-sm px-5 py-2.5"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/')}
            className="text-sm px-5 py-2.5 rounded-xl border-2 border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-semibold"
          >
            Go home
          </button>
        </div>
      </div>
    </div>
  );
}
