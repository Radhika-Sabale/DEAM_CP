import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('shows a clear configuration message without crashing when Supabase keys are absent', () => {
    render(<LoginPage onAuthenticated={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Login not configured/i);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('shows the password visibility control and disables it until auth is configured', () => {
    render(<LoginPage onAuthenticated={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Show' })).toBeDisabled();
  });

  it('shows the same unavailable state in the guest account-action modal', () => {
    render(<LoginPage onAuthenticated={() => undefined} reason="Sign in to save your project." />);
    expect(screen.getByRole('status')).toHaveTextContent(/Login not configured/i);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Show' })).toBeDisabled();
  });

  it('enables sign-in controls when both Supabase settings are present', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://auth.example.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-anon-key');
    render(<LoginPage onAuthenticated={() => undefined} />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Show' })).toBeEnabled();
  });
});
