'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { handleCallback, getReturnUrl } from '@/lib/auth';
import { api } from '@/lib/api';

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setError(errorDescription || errorParam);
      return;
    }

    if (!code || !state) {
      setError('Missing authorization code');
      return;
    }

    handleCallback(code, state)
      .then(({ accessToken }) => {
        // Set token for API calls
        api.setToken(accessToken);

        // Redirect to return URL
        const returnUrl = getReturnUrl();
        router.push(returnUrl);
      })
      .catch((err) => {
        console.error('Auth callback failed:', err);
        setError(err.message || 'Authentication failed');
      });
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authentication Failed</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/" className="btn-primary">
            Return Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-jubilee-600 mx-auto mb-4" />
        <h1 className="text-xl font-semibold text-gray-900">Completing sign in...</h1>
        <p className="text-gray-500 mt-2">Please wait while we authenticate you.</p>
      </div>
    </div>
  );
}
