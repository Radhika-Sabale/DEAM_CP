import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('shows a clear configuration message without crashing when Supabase keys are absent', () => {
    render(<LoginPage onAuthenticated={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Login not configured/i);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDisabled();
  });

  it('shows the password visibility control and disables it until auth is configured', () => {
    render(<LoginPage onAuthenticated={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Show' })).toBeDisabled();
  });
});
