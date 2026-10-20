import { useState, type FC, type FormEvent } from 'react';
import { isAuthConfigured, signIn, signUp, type AuthSession } from './supabaseAuth';

interface LoginPageProps {
  readonly onAuthenticated: (session: AuthSession) => void;
}

export const LoginPage: FC<LoginPageProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [touched, setTouched] = useState(false);

  const emailError = touched && (!email.trim() ? 'Enter your email address.' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Enter a valid email address.' : '');
  const passwordError = touched && (!password ? 'Enter your password.' : password.length < 6 ? 'Use at least 6 characters.' : '');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    setError('');
    setMessage('');
    if (!isAuthConfigured || !email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) return;
    setLoading(true);
    try {
      const session = mode === 'signin' ? await signIn(email.trim(), password, remember) : await signUp(email.trim(), password, remember);
      if (session) onAuthenticated(session);
      else setMessage('Account created. Check your email to confirm the address, then sign in.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Sign-in could not be completed. Try again.');
    } finally { setLoading(false); }
  };

  return (
    <main className="login-page">
      <section className="login-card module-card" aria-labelledby="login-title">
        <div className="login-brand"><span className="brand-mark" aria-hidden="true" /><span className="sidebar-brand-name">DEAM LAB</span></div>
        <span className="eyebrow">DIGITAL ELECTRONICS LAB</span>
        <h1 id="login-title">{mode === 'signin' ? 'Welcome back' : 'Create a student account'}</h1>
        <p className="login-description">Sign in to continue to your laboratory workspace.</p>

        {!isAuthConfigured && <p role="status" className="login-not-configured">Login not configured. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to the local .env file, then restart the app.</p>}
        {error && <p role="alert" className="login-error">{error}</p>}
        {message && <p role="status" className="login-message">{message}</p>}

        <form className="login-form" onSubmit={submit} noValidate>
          <label htmlFor="auth-email">Email</label>
          <input id="auth-email" type="email" autoComplete="email" value={email} onBlur={() => setTouched(true)} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(emailError)} aria-describedby={emailError ? 'auth-email-error' : undefined} disabled={!isAuthConfigured || loading} />
          {emailError && <span id="auth-email-error" className="login-field-error">{emailError}</span>}

          <label htmlFor="auth-password">Password</label>
          <div className="login-password-control">
            <input id="auth-password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onBlur={() => setTouched(true)} onChange={(event) => setPassword(event.target.value)} aria-invalid={Boolean(passwordError)} aria-describedby={passwordError ? 'auth-password-error' : undefined} disabled={!isAuthConfigured || loading} />
            <button type="button" className="login-show-password" onClick={() => setShowPassword((value) => !value)} aria-pressed={showPassword} disabled={!isAuthConfigured || loading}>{showPassword ? 'Hide' : 'Show'}</button>
          </div>
          {passwordError && <span id="auth-password-error" className="login-field-error">{passwordError}</span>}

          <label className="login-remember"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} disabled={loading} />Remember me</label>
          <button type="submit" className="login-submit" disabled={!isAuthConfigured || loading}>{loading ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>

        <p className="login-switch">{mode === 'signin' ? 'New to DEAM Lab?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setMode((value) => value === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); setTouched(false); }}>{mode === 'signin' ? 'Create a student account' : 'Sign in'}</button>
        </p>
      </section>
    </main>
  );
};
