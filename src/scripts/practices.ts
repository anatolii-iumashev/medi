export interface Practice {
  readonly id: string;
  readonly title: string;
  readonly duration: string;
  readonly src: string;
}

const base = import.meta.env.BASE_URL;

export const PRACTICES: readonly Practice[] = [
  {
    id: 'quiet-breathing',
    title: 'Тихое дыхание',
    duration: '6 минут',
    src: `${base}audio/meditation.mp3`,
  },
  {
    id: 'shamanic-drums',
    title: 'Шаманские барабаны',
    duration: '32 секунды',
    src: `${base}audio/shamanic-drums-loop.mp3`,
  },
];

export const DEFAULT_PRACTICE = PRACTICES[0];
