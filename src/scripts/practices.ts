export const SESSION_DURATIONS = [3, 5, 10] as const;
export type SessionDuration = (typeof SESSION_DURATIONS)[number];
export const DEFAULT_SESSION_DURATION: SessionDuration = 3;

export interface Practice {
  readonly id: string;
  readonly title: string;
  readonly duration: string;
  readonly src: string;
  readonly sessionDurations?: readonly SessionDuration[];
}

const base = import.meta.env.BASE_URL;

export const PRACTICES: readonly Practice[] = [
  {
    id: 'breathing-triangle',
    title: 'Треугольник дыхания',
    duration: '3–10 минут',
    src: `${base}audio/breathing-triangle.mp3`,
    sessionDurations: SESSION_DURATIONS,
  },
  {
    id: 'shamanic-drums',
    title: 'Шаманские барабаны',
    duration: '1 час',
    src: `${base}audio/shamanic-drums-loop.mp3`,
  },
  {
    id: 'soft-white-noise',
    title: 'Мягкий белый шум',
    duration: '1 час',
    src: `${base}audio/soft-white-noise.mp3`,
  },
];

export const DEFAULT_PRACTICE = PRACTICES[0];

export function isSessionDuration(value: number): value is SessionDuration {
  return SESSION_DURATIONS.includes(value as SessionDuration);
}
