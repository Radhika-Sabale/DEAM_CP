import { describe, expect, it, vi } from 'vitest';
import { requireAccount } from './requireAccount';

describe('requireAccount', () => {
  it('hands the requested action to the app instead of running it for a guest', () => {
    const action = vi.fn();
    const listener = vi.fn((event: Event) => {
      const detail = (event as CustomEvent<{ reason: string; continueAction: () => void }>).detail;
      expect(detail.reason).toBe('Sign in to submit your results.');
      expect(detail.continueAction).toBe(action);
    });
    window.addEventListener('deam:require-account', listener);
    requireAccount('Sign in to submit your results.', action);
    expect(action).not.toHaveBeenCalled();
    const detail = listener.mock.calls[0]?.[0] as CustomEvent<{ continueAction: () => void }>;
    detail.detail.continueAction();
    expect(action).toHaveBeenCalledOnce();
    window.removeEventListener('deam:require-account', listener);
  });
});
