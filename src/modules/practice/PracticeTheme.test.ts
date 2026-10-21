import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');
const darkTheme = css.match(/:root\.dark,\s*:root\[data-theme='dark'\]\s*\{([^}]*)\}/)?.[1] ?? '';
const darkTokens = Object.fromEntries(
  [...darkTheme.matchAll(/(--[\w-]+):\s*(#[\da-fA-F]{6})/g)].map(([, name, value]) => [name, value])
);

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255);
  const linear = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
}

function contrast(first: string, second: string): number {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0]! + 0.05) / (values[1]! + 0.05);
}

describe('Practice dark theme tokens', () => {
  it('defines every semantic surface and foreground token used by Practice', () => {
    for (const token of ['--bg', '--ink', '--muted', '--line', '--card', '--soft', '--input-surface', '--active-surface', '--teal', '--green-text', '--red', '--amber-text']) {
      expect(darkTokens[token], `${token} should be defined in the dark theme`).toBeDefined();
    }
    expect(css).toContain('.practice-page input:not([type="radio"]),.practice-page select');
    expect(css).toContain('color: var(--ink) !important; background-color: var(--input-surface) !important');
    expect(css).toContain('.dark [class~="dark:text-gray-200"]');
    expect(css).toContain('.dark [class~="dark:text-gray-300"]');
    expect(css).toContain('[class~="dark:bg-gray-800"] { background-color: var(--input-surface) !important; }');
  });

  it('keeps Practice foreground and status text at WCAG AA contrast on its surfaces', () => {
    for (const foreground of ['--ink', '--muted', '--teal', '--green-text', '--red', '--amber-text']) {
      for (const background of ['--card', '--input-surface', '--soft', '--active-surface']) {
        expect(contrast(darkTokens[foreground]!, darkTokens[background]!), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
