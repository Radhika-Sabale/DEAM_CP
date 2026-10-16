import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import App from './App';
import { useUiStore } from './store/uiStore';

describe('App', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
    useUiStore.getState().setModule('boolean-tool');
  });

  afterEach(() => vi.restoreAllMocks());

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

  it('shows a home link for unknown routes', () => {
    window.history.replaceState(null, '', '/#/not-a-module');
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Boolean' })).toHaveAttribute('href', '#/boolean-tool');
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
