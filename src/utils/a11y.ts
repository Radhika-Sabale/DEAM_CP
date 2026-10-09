/**
 * @file a11y.ts
 * Screen reader accessibility utilities: live announcements, unique ID generation,
 * and accessible score labeling (Stage 11C).
 */

let idCounter = 0;

/**
 * Ensures a single shared, visually-hidden ARIA live region exists in document.body.
 */
function getOrCreateAnnouncer(politeness: 'polite' | 'assertive'): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const id = `delab-live-announcer-${politeness}`;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.setAttribute('aria-live', politeness);
    el.setAttribute('aria-atomic', 'true');
    // Visually hidden styles
    el.style.position = 'absolute';
    el.style.width = '1px';
    el.style.height = '1px';
    el.style.padding = '0';
    el.style.margin = '-1px';
    el.style.overflow = 'hidden';
    el.style.clip = 'rect(0, 0, 0, 0)';
    el.style.whiteSpace = 'nowrap';
    el.style.border = '0';
    document.body.appendChild(el);
  }
  return el;
}

/**
 * Announces a message to screen reader assistive technologies.
 *
 * @param message The text message to announce
 * @param politeness ARIA politeness level ('polite' | 'assertive')
 */
export function announce(
  message: string,
  politeness: 'polite' | 'assertive' = 'polite'
): void {
  if (!message || typeof document === 'undefined') return;

  const el = getOrCreateAnnouncer(politeness);
  if (el) {
    // Clear and re-populate with small delay to force screen readers to register identical repeats
    el.textContent = '';
    setTimeout(() => {
      el.textContent = message;
    }, 50);
  }
}

/**
 * Generates a collision-free unique HTML id attribute with a given prefix.
 *
 * @param prefix Prefix string (e.g. 'input', 'q-nav')
 */
export function uniqueId(prefix: string = 'id'): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Builds an accessible ARIA label for score summaries.
 *
 * @param score Student's achieved score
 * @param maxScore Maximum possible points
 * @param label Optional subject or assessment name
 */
export function formatScoreAriaLabel(
  score: number,
  maxScore: number,
  label?: string
): string {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const prefix = label ? `${label}: ` : '';
  return `${prefix}Score ${score} out of ${maxScore} (${percentage} percent)`;
}

/**
 * Resets announcer and ID counter for test isolation.
 */
export function resetA11yForTesting(): void {
  idCounter = 0;
  if (typeof document !== 'undefined') {
    const polite = document.getElementById('delab-live-announcer-polite');
    const assertive = document.getElementById('delab-live-announcer-assertive');
    if (polite) polite.remove();
    if (assertive) assertive.remove();
  }
}
