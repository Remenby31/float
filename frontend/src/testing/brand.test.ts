/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = JSON.parse(readFileSync('public/brand/tokens.json', 'utf8')) as {
  themes: Record<string, Record<string, string>>;
};

function luminance(hex: string) {
  const [r, g, b] = hex.slice(1).match(/.{2}/g)!.map((channel) => {
    const value = parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

describe('Daybook contrast', () => {
  for (const [name, theme] of Object.entries(tokens.themes)) {
    it(`${name}: normal text is readable on each content surface`, () => {
      for (const foreground of ['text', 'text-secondary', 'text-muted', 'accent', 'danger']) {
        for (const background of ['bg', 'surface', 'elevated']) {
          expect(contrast(theme[foreground], theme[background]), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
        }
      }
    });
    it(`${name}: action text and checkbox boundaries stay visible`, () => {
      expect(contrast(theme['accent-fg'], theme.accent)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme['border-strong'], theme.bg)).toBeGreaterThanOrEqual(3);
    });
  }
});
