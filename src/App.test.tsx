import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import App from './App';
import { useUiStore } from './store/uiStore';
import type { ModuleId } from './types/designProject';

describe('App', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    window.history.replaceState(null, '', '/');
    useUiStore.getState().setModule('boolean-tool');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('renders the main heading', async () => {
    render(<App />);
    const heading = await screen.findByRole('heading', {
      name: /digital electronics virtual lab/i,
      level: 1,
    });
    expect(heading).toBeInTheDocument();
  });

  it('writes the canonical hash route when no hash is present', async () => {
    render(<App />);
    await waitFor(() => expect(window.location.hash).toBe('#/boolean-tool'));
  });

  it('lets guests open lab modules without a login redirect', async () => {
    useUiStore.getState().setModule('number-systems');
    window.history.replaceState(null, '', '/#/number-systems');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create account' })).toBeInTheDocument();
    expect(window.location.hash).toBe('#/number-systems');
  });

  it('shows a home link for unknown routes', () => {
    window.history.replaceState(null, '', '/#/not-a-module');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Boolean' })).toHaveAttribute('href', '#/boolean-tool');
  });

  it.each([
    ['number-systems', '.number-systems-page'],
    ['boolean-tool', '.boolean-page'],
    ['kmap-solver', '.kmap-workbench-grid'],
    ['circuit-simulator', '.circuit-workbench'],
    ['flipflop-simulator', '.flipflop-page'],
    ['sequential-designer', '.sequential-page'],
    ['practice', '.practice-page'],
    ['quiz', '.quiz-page'],
    ['prepost-test', '.prepost-page'],
    ['sus-survey', '.sus-page'],
    ['alu', '.alu-page'],
    ['8086-cpu', '.cpu-page'],
    ['interrupt-controller', '.interrupt-page'],
  ])('renders guest route %s without waiting for auth', async (route, contentSelector) => {
    useUiStore.getState().setModule(route as ModuleId);
    window.history.replaceState(null, '', `/#/${route}`);
    const { unmount } = render(<App />);
    const main = screen.getByRole('main');
    expect(screen.queryByText(/Checking sign-in/i)).not.toBeInTheDocument();
    await waitFor(() => expect(main.querySelector(contentSelector)).toBeInTheDocument(), { timeout: 10_000 });
    expect(screen.queryByText(/Checking sign-in/i)).not.toBeInTheDocument();
    unmount();
  });

  it('keeps the teacher access check inside the teacher page while guests browse', async () => {
    useUiStore.getState().setModule('teacher-dashboard');
    window.history.replaceState(null, '', '/#/teacher-dashboard');
    render(<App />);
    const main = screen.getByRole('main');
    expect(screen.queryByText(/Checking sign-in/i)).not.toBeInTheDocument();
    expect(await within(main).findByRole('heading', { name: 'Login not configured' })).toBeInTheDocument();
  });

  it('keeps one hashchange listener while routing between modules', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    render(<App />);
    await waitFor(() => expect(window.location.hash).toBe('#/boolean-tool'));
    expect(addListener.mock.calls.filter(([type]) => type === 'hashchange')).toHaveLength(1);
    fireEvent.click(screen.getAllByRole('button', { name: /Karnaugh Map Minimizer/i })[0]!);
    await waitFor(() => expect(window.location.hash).toBe('#/kmap-solver'));
    expect(addListener.mock.calls.filter(([type]) => type === 'hashchange')).toHaveLength(1);
  });
});
