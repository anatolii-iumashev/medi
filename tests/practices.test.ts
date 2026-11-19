import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRACTICE,
  DEFAULT_SESSION_DURATION,
  PRACTICES,
  isSessionDuration,
} from '../src/scripts/practices';

describe('practices', () => {
  it('defines exactly three practices with one breathing loop and three session durations', () => {
    expect(PRACTICES.map((practice) => practice.id)).toEqual([
      'breathing-triangle',
      'shamanic-drums',
      'soft-white-noise',
    ]);
    expect(DEFAULT_PRACTICE).toMatchObject({
      title: 'Треугольник дыхания',
      description: 'Вдох 7 с · тишина 7 с · выдох 7 с',
      duration: '3–10 минут',
      sessionDurations: [3, 5, 10],
    });
    expect(DEFAULT_SESSION_DURATION).toBe(3);

    for (const practice of PRACTICES) {
      expect(practice.title).not.toBe('');
      expect(practice.description).not.toBe('');
      expect(practice.src).toMatch(/audio\/[a-z-]+\.mp3$/);
    }
    for (const practice of PRACTICES.slice(1)) {
      expect(practice.duration).toBe('1 час');
      expect(practice.sessionDurations).toBeUndefined();
    }
  });

  it('accepts only the three supported session durations', () => {
    expect([3, 5, 10].filter(isSessionDuration)).toEqual([3, 5, 10]);
    expect([1, 4, 15, Number.NaN].filter(isSessionDuration)).toEqual([]);
  });
});
