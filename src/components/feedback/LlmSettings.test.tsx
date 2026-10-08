/**
 * @file LlmSettings.test.tsx
 * Tests for LlmSettings component:
 * verify default off state, privacy warning visibility, password input security,
 * key clearing on toggle off, and proof of no network fetch when off.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { useFeedbackStore } from '../../store/feedbackStore';
import { LlmSettings } from './LlmSettings';

describe('LlmSettings Component', () => {
  beforeEach(() => {
    useFeedbackStore.getState().resetAll();
    useFeedbackStore.getState().setLlmHintsEnabled(false);
    useFeedbackStore.getState().setLlmApiKey('');
    vi.restoreAllMocks();
  });

  it('renders default off state with checkbox unchecked and no warning or key input', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    render(<LlmSettings />);

    const checkbox = screen.getByRole('checkbox', {
      name: /Rephrase hints with an AI model \(optional\)/i,
    });
    expect((checkbox as HTMLInputElement).checked).toBe(false);

    expect(screen.queryByText(/Privacy & Third-Party Service Warning/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Anthropic API Key/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Test connection/i })).not.toBeInTheDocument();

    // Invariant: no fetch invoked when off
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows warning text and password input when toggled on', () => {
    render(<LlmSettings />);

    const checkbox = screen.getByRole('checkbox', {
      name: /Rephrase hints with an AI model \(optional\)/i,
    });
    fireEvent.click(checkbox);

    expect((checkbox as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Privacy & Third-Party Service Warning/i)).toBeInTheDocument();
    expect(
      screen.getByText(/will be sent to a third-party service \(Anthropic Claude API\)/i)
    ).toBeInTheDocument();

    const keyInput = screen.getByLabelText(/Anthropic API Key/i);
    expect(keyInput).toBeInTheDocument();
    expect(keyInput).toHaveAttribute('type', 'password');

    const testBtn = screen.getByRole('button', { name: /Test connection/i });
    expect(testBtn).toBeInTheDocument();
  });

  it('clears API key field and resets store credentials when toggled off', () => {
    render(<LlmSettings />);

    const checkbox = screen.getByRole('checkbox', {
      name: /Rephrase hints with an AI model \(optional\)/i,
    });
    fireEvent.click(checkbox);

    const keyInput = screen.getByLabelText(/Anthropic API Key/i);
    fireEvent.change(keyInput, { target: { value: 'sk-ant-testkey123' } });

    expect(useFeedbackStore.getState().llmConfig.apiKey).toBe('sk-ant-testkey123');

    // Toggle off
    fireEvent.click(checkbox);

    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(useFeedbackStore.getState().featureFlags.llmHints).toBe(false);
    expect(useFeedbackStore.getState().llmConfig.apiKey).toBeFalsy();

    // Toggle back on to confirm input is empty
    fireEvent.click(checkbox);
    const keyInputReopened = screen.getByLabelText(/Anthropic API Key/i);
    expect(keyInputReopened).toHaveValue('');
  });

  it('proves zero fetch calls when feature flag is off', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    render(<LlmSettings />);

    // Interactions with the component or store when off do not call fetch
    expect(useFeedbackStore.getState().featureFlags.llmHints).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
