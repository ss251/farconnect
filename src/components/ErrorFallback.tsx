'use client';

import { useEffect } from 'react';

interface ErrorFallbackProps {
  error: Error;
  resetError: () => void;
}

export function ErrorFallback({ error, resetError }: ErrorFallbackProps) {
  useEffect(() => {
    // Log error to console in development
    console.error('Error caught:', error);
  }, [error]);

  return (
    <div className="min-h-[400px] flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-xl">❌</span>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Oops! Something went wrong
        </h3>
        <p className="text-sm text-gray-600 mb-4 max-w-sm mx-auto">
          {error.message || 'An unexpected error occurred while loading this content.'}
        </p>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}