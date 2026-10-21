export function requireAccount(reason: string, continueAction: () => void): void {
  window.dispatchEvent(new CustomEvent('deam:require-account', { detail: { reason, continueAction } }));
}
