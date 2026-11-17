import { describe, expect, it } from 'vitest';
import { DEFAULT_PRACTICE, PRACTICES } from '../src/scripts/practices';

describe('practices', () => {
  it('defines exactly three hour-long practices', () => {
    expect(PRACTICES.map((practice) => practice.id)).toEqual([
      'quiet-breathing',
      'shamanic-drums',
      'soft-white-noise',
    ]);
    for (const practice of PRACTICES) {
      expect(practice.title).not.toBe('');
      expect(practice.duration).toBe('1 час');
      expect(practice.src).toMatch(/audio\/[a-z-]+\.mp3$/);
    }
    expect(DEFAULT_PRACTICE.id).toBe('quiet-breathing');
  });
});
