'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function AuthPage() {
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
  };

  const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300';
  const btnCls   = 'w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-sm w-full space-y-6">
        <div className="text-center">
          <span className="text-4xl">💰</span>
          <h1 className="text-2xl font-bold text-gray-900 mt-3">My Finance Partner</h1>
          <p className="text-sm text-gray-400 mt-1">Family finance tracker</p>
        </div>

        {sent ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm text-center space-y-2">
            <p className="text-3xl">📧</p>
            <p className="text-sm font-semibold text-gray-900">Check your email</p>
            <p className="text-xs text-gray-500">
              We sent a sign-in link to <span className="font-medium">{email}</span>.<br />
              The link expires in 1 hour.
            </p>
            <button
              onClick={() => { setSent(false); setEmail(''); }}
              className="text-xs text-indigo-600 hover:underline mt-2"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-0.5">Sign in</h2>
              <p className="text-xs text-gray-500">Enter your email to receive a magic link — no password needed.</p>
            </div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className={inputCls}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className={btnCls}>
              {loading ? 'Sending…' : 'Send Magic Link'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
