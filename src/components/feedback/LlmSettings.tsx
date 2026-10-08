/**
 * @file LlmSettings.tsx
 * UI controls for the optional display-only AI hint rephrasing feature flag,
 * including ethical disclosure warning, secure password input for API keys,
 * session storage choice, and connection verification testing.
 */

import { type FC, useState } from 'react';
import { useFeedbackStore } from '../../store/feedbackStore';
import { clearStoredApiKey, rephraseDiagnosis } from '../../engine/feedback/llmAdapter';
import type { Diagnosis } from '../../types/feedback';

export interface LlmSettingsProps {
  readonly className?: string;
}

export const LlmSettings: FC<LlmSettingsProps> = ({ className = '' }) => {
  const { featureFlags, llmConfig, setLlmHintsEnabled, setLlmApiKey } = useFeedbackStore();
  const [apiKeyInput, setApiKeyInput] = useState<string>(llmConfig.apiKey ?? '');
  const [rememberInTab, setRememberInTab] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);

  const isEnabled = featureFlags.llmHints;

  const handleToggleEnabled = (checked: boolean) => {
    setLlmHintsEnabled(checked);
    if (!checked) {
      // Clear all stored credentials when toggled off
      setApiKeyInput('');
      clearStoredApiKey();
      setLlmApiKey('', false);
      setTestStatus(null);
    }
  };

  const handleApiKeyChange = (value: string) => {
    setApiKeyInput(value);
    setLlmApiKey(value, rememberInTab);
    setTestStatus(null);
  };

  const handleRememberChange = (remember: boolean) => {
    setRememberInTab(remember);
    if (apiKeyInput) {
      setLlmApiKey(apiKeyInput, remember);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKeyInput.trim()) {
      setTestStatus('Please enter an API key first.');
      return;
    }

    setIsTesting(true);
    setTestStatus('Testing connection...');

    const sampleDiagnosis: Diagnosis = {
      step: 'test-step',
      errorType: 'syntax-error',
      expected: {
        kind: 'number-conversion-step',
        targetValue: '1',
        intermediateSteps: ['1'],
      },
      got: {
        kind: 'number-conversion-step',
        studentValue: '0',
        intermediateWork: ['0'],
      },
      misconceptionTag: 'other',
      hint: 'Sample hint for connection test',
      fullExplanation: 'Original diagnostic calculation explanation.',
    };

    try {
      const result = await rephraseDiagnosis(sampleDiagnosis, {
        enabled: true,
        provider: 'anthropic',
        apiKey: apiKeyInput.trim(),
        timeoutMs: 5000,
      });

      if (result.wasRephrased) {
        setTestStatus('Connection successful: AI model responded.');
      } else {
        setTestStatus(
          result.fallbackReason
            ? `Connection failed (${result.fallbackReason})`
            : 'Connection failed'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestStatus(`Connection error: ${msg}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div
      className={`p-4 border rounded bg-white shadow-sm dark:bg-slate-900 dark:border-slate-800 ${className}`}
      data-testid="llm-settings"
    >
      <div className="flex items-center gap-2 mb-3">
        <input
          id="llm-toggle"
          type="checkbox"
          checked={isEnabled}
          onChange={(e) => handleToggleEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <label
          htmlFor="llm-toggle"
          className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
        >
          Rephrase hints with an AI model (optional)
        </label>
      </div>

      {isEnabled && (
        <div className="mt-3 pl-6 border-l-2 border-indigo-200 dark:border-indigo-800 space-y-4">
          <div
            role="alert"
            className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded text-xs text-amber-900 dark:text-amber-200"
          >
            <div className="font-semibold flex items-center gap-1 mb-1">
              <span aria-hidden="true">&#9888;</span> Privacy & Third-Party Service Warning
            </div>
            <p>
              When enabled, student step submissions and feedback prompts will be sent to a
              third-party service (Anthropic Claude API). Do not submit confidential data.
            </p>
          </div>

          <div>
            <label
              htmlFor="llm-api-key"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
            >
              Anthropic API Key
            </label>
            <input
              id="llm-api-key"
              type="password"
              value={apiKeyInput}
              autoComplete="off"
              placeholder="sk-ant-..."
              onChange={(e) => handleApiKeyChange(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border rounded font-mono bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="llm-remember-tab"
              type="checkbox"
              checked={rememberInTab}
              onChange={(e) => handleRememberChange(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label
              htmlFor="llm-remember-tab"
              className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer"
            >
              Remember for this tab (session storage only, never permanent)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting || !apiKeyInput.trim()}
              className="px-3 py-1.5 text-xs font-medium rounded bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white transition-colors"
            >
              {isTesting ? 'Testing...' : 'Test connection'}
            </button>
            {testStatus && (
              <span
                role="status"
                aria-live="polite"
                className="text-xs text-slate-700 dark:text-slate-300"
              >
                {testStatus}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
