import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { api, authToken } from '@/lib/api/client';
import { queryClient } from '@/lib/query-client';
import { meQueryOptions } from '@/features/auth/api/queries';
import { Brand } from '@/components/Brand';
import { MoonIcon, SunIcon } from '@/components/icons';
import { useUiStore } from '@/stores/ui-store';

export function LoginPage() {
  const navigate = useNavigate();
  const emailRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [shaking, setShaking] = useState(false);
  const theme = useUiStore((state) => state.theme);
  const toggleTheme = useUiStore((state) => state.toggleTheme);

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
    <main className="login-page safe-top">
      <header className="login-masthead"><Brand /><p className="eyebrow">Make room for what matters.</p><button aria-label="toggle theme" className="icon-button" onClick={toggleTheme} type="button">{theme === 'dark' ? <SunIcon size={18} /> : <MoonIcon size={18} />}</button></header>
      <div className="login-layout">
        <section aria-label="Welcome to Float"><p className="eyebrow mb-7">A little less on your mind.</p><h1 className="login-statement"><span className="login-line">LESS<span className="login-word-break"> </span>NOISE.</span><span className="login-line">MORE<span className="login-word-break"> </span>DOING<span aria-hidden="true" className="brand-stop" /></span></h1><p className="login-caption">A simple place for your tasks, your projects, and a little room to breathe.</p></section>
      <section className="login-form">
        <p className="eyebrow">Your everyday, a little lighter.</p><h2 className="section-title">Welcome back.</h2><p className="login-form-intro">Pick up where you left off.</p>
        <form
          className={shaking ? 'animate-shake' : ''}
          onSubmit={handleSubmit}
        >
          <div>
            {error ? <p className="login-error" role="alert">{error}</p> : null}
            <label className="block">
              <span className="field-label">email</span>
              <input
                ref={emailRef}
                autoComplete="email"
                className="field"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="email"
                type="email"
                required
                value={email}
              />
            </label>
            <label className="relative block">
              <span className="field-label">password</span>
              <input
                autoComplete="current-password"
                aria-label="password"
                className="field pr-16"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="password"
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
              />
              <button
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute bottom-0 right-0 h-12 px-4 text-xs text-text-muted hover:text-text-secondary"
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              >
                {showPassword ? 'hide' : 'show'}
              </button>
            </label>
            <button className="primary-button w-full" disabled={submitting} type="submit">
              {submitting ? <span className="spinner" aria-label="signing in" /> : <><span>sign in</span><span aria-hidden="true">↗</span></>}
            </button>
          </div>
        </form>
      </section>
      </div>
      <footer className="login-footer"><span className="eyebrow">One day at a time.</span><a className="eyebrow hover:text-text" href="/brand">The Float brand kit ↗</a></footer>
    </main>
  );
}
