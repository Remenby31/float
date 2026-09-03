import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { api, authToken } from '@/lib/api/client';
import { queryClient } from '@/lib/query-client';
import { meQueryOptions } from '@/features/auth/api/queries';

export function LoginPage() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);

  useEffect(() => emailRef.current?.focus(), []);

  const triggerShake = () => {
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
    window.setTimeout(() => setShaking(false), 500);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email || !password) {
      setError('all fields required');
      triggerShake();
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const response = await api.login({ email, password });
      authToken.set(response.token);
      queryClient.setQueryData(meQueryOptions().queryKey, response.user);
      await navigate({ to: '/app', replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'login failed');
      triggerShake();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg px-5">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(128,132,255,0.16),transparent_42%)]" />
      <section className="relative w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <FloatMark />
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.04em] text-text">float</h1>
            <p className="mt-0.5 text-xs text-text-muted">clear the weight. keep moving.</p>
          </div>
        </div>

        <form
          className={`rounded-2xl border border-border bg-elevated/85 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)] backdrop-blur-xl ${shaking ? 'animate-shake' : ''}`}
          onSubmit={handleSubmit}
        >
          <div className="space-y-3">
            {error ? <p className="px-1 text-xs text-danger">{error}</p> : null}
            <label className="block">
              <span className="sr-only">email</span>
              <input
                ref={emailRef}
                autoComplete="email"
                className="field"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email"
                type="email"
                value={email}
              />
            </label>
            <label className="relative block">
              <span className="sr-only">password</span>
              <input
                autoComplete="current-password"
                className="field pr-12"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
              />
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text-secondary"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? 'hide' : 'show'}
              </button>
            </label>
            <button className="primary-button w-full" disabled={submitting} type="submit">
              {submitting ? <span className="spinner" aria-label="signing in" /> : 'sign in'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function FloatMark() {
  return (
    <div className="relative h-11 w-11 rounded-2xl border border-border bg-surface shadow-sm">
      <span className="absolute left-[13px] top-[8px] h-5 w-5 rounded-full bg-text" />
      <span className="absolute bottom-[9px] left-[15px] h-1 w-4 rounded-full bg-text/15" />
    </div>
  );
}
