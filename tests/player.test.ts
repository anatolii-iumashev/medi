import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeditationPlayer } from '../src/scripts/player';
import type { Practice } from '../src/scripts/practices';

const breathing: Practice = {
  id: 'breathing',
  title: 'Треугольник дыхания',
  duration: '3–10 минут',
  src: '/medi/audio/breathing-triangle.mp3',
  sessionDurations: [3, 5, 10],
};

const drums: Practice = {
  id: 'drums',
  title: 'Шаманские барабаны',
  duration: '1 час',
  src: '/medi/audio/shamanic-drums-loop.mp3',
};

class FakeAudio extends EventTarget {
  paused = true;
  currentTime = 0;
  loop = false;
  src = '';
  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  });
  load = vi.fn();
}

function setup(initial: Practice = breathing) {
  const audio = new FakeAudio();
  const toggle = { textContent: 'Начать', setAttribute: vi.fn(), addEventListener: vi.fn() } as unknown as HTMLButtonElement;
  const status = { textContent: '' } as HTMLElement;
  const indicator = { className: 'status', dataset: {} } as unknown as HTMLElement;
  const handlers = new Map<string, () => void | Promise<void>>();
  const mediaSession = {
    metadata: null,
    playbackState: 'none',
    setActionHandler: vi.fn((action: string, handler: () => void | Promise<void>) => {
      handlers.set(action, handler);
    }),
  } as unknown as MediaSession;
  vi.stubGlobal('MediaMetadata', class {
    constructor(public data: MediaMetadataInit) {}
  });
  const player = new MeditationPlayer(
    audio,
    { toggle, status, indicator },
    mediaSession,
    [{ src: '/medi/icons/icon-512.png', sizes: '512x512', type: 'image/png' }],
    initial,
  );
  return { audio, toggle, status, indicator, handlers, mediaSession, player };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MeditationPlayer', () => {
  it('loads the selected practice without autoplay and keeps the loop', () => {
    const { audio, toggle, status } = setup();
    expect(audio.src).toBe(breathing.src);
    expect(audio.load).toHaveBeenCalledOnce();
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.loop).toBe(true);
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('Загружаем');
  });

  it('starts only after an explicit action and reflects the play event', async () => {
    const { audio, toggle, status, player } = setup();
    expect(audio.play).not.toHaveBeenCalled();
    await player.toggle();
    expect(toggle.textContent).toBe('Стоп');
    expect(status.textContent).toContain('Треугольник дыхания');
    expect(audio.loop).toBe(true);
  });

  it('stops, rewinds and starts again from the beginning', async () => {
    const { audio, toggle, status, player } = setup();
    await player.toggle();
    audio.currentTime = 12;
    await player.toggle();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.currentTime).toBe(0);
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('Остановлено');
    await player.toggle();
    expect(audio.currentTime).toBe(0);
  });

  it('handles a rejected play promise without an unhandled error', async () => {
    const { audio, toggle, status, player } = setup();
    audio.play.mockRejectedValueOnce(new DOMException('Blocked', 'NotAllowedError'));
    await expect(player.toggle()).resolves.toBeUndefined();
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('недоступно');
  });

  it('reflects an external pause and keeps the position', async () => {
    const { audio, toggle, status, player } = setup();
    await player.toggle();
    audio.currentTime = 8;
    audio.pause();
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('Пауза');
    expect(audio.currentTime).toBe(8);
  });

  it('shows buffering only while audio is still playing', async () => {
    const { audio, toggle, status, player } = setup();
    await player.toggle();
    audio.dispatchEvent(new Event('waiting'));
    expect(toggle.textContent).toBe('Стоп');
    expect(status.textContent).toContain('Подключаем');
  });

  it('shows an audio error and restores the start action', async () => {
    const { audio, toggle, status, player } = setup();
    await player.toggle();
    audio.paused = true;
    audio.dispatchEvent(new Event('error'));
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('недоступно');
  });

  it('switches the source, resets the position and does not autoplay', async () => {
    const { audio, toggle, status, player } = setup();
    await player.toggle();
    audio.currentTime = 11;
    player.select(drums);
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
    expect(audio.src).toBe(drums.src);
    expect(audio.load).toHaveBeenCalledTimes(2);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('Шаманские барабаны');
  });

  it('does not restart the active practice and duration when selected again', async () => {
    const { audio, player } = setup();
    player.select(breathing);
    player.selectDuration(3);
    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.load).toHaveBeenCalledOnce();
    expect(audio.src).toBe(breathing.src);
  });

  it('plays the new practice from the beginning after a switch', async () => {
    const { audio, toggle, status, player } = setup();
    await player.toggle();
    player.select(drums);
    audio.dispatchEvent(new Event('canplay'));
    expect(status.textContent).toContain('Шаманские барабаны');
    await player.toggle();
    expect(audio.currentTime).toBe(0);
    expect(toggle.textContent).toBe('Стоп');
  });

  it('ignores a stale rejected play after a fast switch', async () => {
    const { audio, status, player } = setup();
    let rejectFirst: (reason: unknown) => void = () => {};
    audio.play.mockImplementationOnce(() => new Promise<void>((_, reject) => {
      rejectFirst = reject;
    }));
    const pending = player.toggle();
    player.select(drums);
    rejectFirst(new DOMException('Aborted', 'AbortError'));
    await expect(pending).resolves.toBeUndefined();
    expect(status.textContent).toContain('Шаманские барабаны');
    expect(status.textContent).not.toContain('недоступно');
  });

  it('ignores a stale rejected play after a duration change', async () => {
    const { audio, status, player } = setup();
    let rejectFirst: (reason: unknown) => void = () => {};
    audio.play.mockImplementationOnce(() => new Promise<void>((_, reject) => {
      rejectFirst = reject;
    }));
    const pending = player.toggle();
    player.selectDuration(5);
    rejectFirst(new DOMException('Aborted', 'AbortError'));
    await expect(pending).resolves.toBeUndefined();
    expect(status.textContent).not.toContain('недоступно');
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it('keeps the last practice after rapid switches', () => {
    const { audio, player } = setup();
    player.select(drums);
    player.select(breathing);
    player.select(drums);
    expect(audio.src).toBe(drums.src);
  });

  it.each([
    [3, 180_000],
    [5, 300_000],
    [10, 600_000],
  ])('finishes the %i-minute session by its own timer', async (duration, milliseconds) => {
    vi.useFakeTimers();
    const { audio, toggle, status, mediaSession, player } = setup();
    player.selectDuration(duration);
    await player.toggle();
    await vi.advanceTimersByTimeAsync(milliseconds - 1);
    expect(toggle.textContent).toBe('Стоп');
    await vi.advanceTimersByTimeAsync(1);
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('Практика завершена');
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);
    expect(mediaSession.playbackState).toBe('none');
    await player.toggle();
    expect(toggle.textContent).toBe('Стоп');
    expect(audio.currentTime).toBe(0);
    await vi.advanceTimersByTimeAsync(milliseconds);
    expect(status.textContent).toContain('Практика завершена');
  });

  it('preserves the remaining session time across an external pause', async () => {
    vi.useFakeTimers();
    const { audio, status, player } = setup();
    await player.toggle();
    await vi.advanceTimersByTimeAsync(60_000);
    audio.pause();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(status.textContent).toContain('Пауза');
    await player.toggle();
    await vi.advanceTimersByTimeAsync(119_999);
    expect(status.textContent).toContain('Звучит');
    await vi.advanceTimersByTimeAsync(1);
    expect(status.textContent).toContain('Практика завершена');
  });

  it('pauses the countdown while buffering', async () => {
    vi.useFakeTimers();
    const { audio, status, player } = setup();
    await player.toggle();
    await vi.advanceTimersByTimeAsync(60_000);
    audio.dispatchEvent(new Event('waiting'));
    await vi.advanceTimersByTimeAsync(600_000);
    expect(status.textContent).toContain('Подключаем');
    audio.dispatchEvent(new Event('canplay'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(status.textContent).toContain('Практика завершена');
  });

  it('cancels the old timer and resets the position when duration changes', async () => {
    vi.useFakeTimers();
    const { audio, player } = setup();
    await player.toggle();
    audio.currentTime = 9;
    await vi.advanceTimersByTimeAsync(60_000);
    player.selectDuration(5);
    expect(audio.currentTime).toBe(0);
    expect(audio.paused).toBe(true);
    expect(audio.play).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(600_000);
    await player.toggle();
    await vi.advanceTimersByTimeAsync(299_999);
    expect(audio.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(audio.paused).toBe(true);
  });

  it('keeps the last duration after rapid changes', async () => {
    vi.useFakeTimers();
    const { audio, status, player } = setup();
    player.selectDuration(5);
    player.selectDuration(3);
    player.selectDuration(10);
    await player.toggle();
    await vi.advanceTimersByTimeAsync(300_000);
    expect(audio.paused).toBe(false);
    await vi.advanceTimersByTimeAsync(300_000);
    expect(status.textContent).toContain('Практика завершена');
  });

  it('does not use a session timer for hour-long practices', async () => {
    vi.useFakeTimers();
    const { audio, status, player } = setup(drums);
    await player.toggle();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(audio.paused).toBe(false);
    expect(status.textContent).toContain('Звучит');
  });

  it('cancels a breathing timer when switching to another practice', async () => {
    vi.useFakeTimers();
    const { audio, status, player } = setup();
    await player.toggle();
    player.select(drums);
    await vi.advanceTimersByTimeAsync(600_000);
    expect(status.textContent).not.toContain('Практика завершена');
    await player.toggle();
    await vi.advanceTimersByTimeAsync(600_000);
    expect(audio.paused).toBe(false);
  });

  it('exposes media metadata and play, pause and stop actions', async () => {
    const { audio, handlers, mediaSession } = setup();
    expect(mediaSession.metadata).toMatchObject({ data: { title: 'Треугольник дыхания', artist: 'medi' } });
    expect([...handlers.keys()]).toEqual(['play', 'pause', 'stop']);
    await handlers.get('play')?.();
    expect(audio.paused).toBe(false);
    handlers.get('pause')?.();
    expect(audio.paused).toBe(true);
    audio.currentTime = 15;
    await handlers.get('stop')?.();
    expect(audio.currentTime).toBe(0);
  });

  it('updates media metadata when the practice changes', () => {
    const { mediaSession, player } = setup();
    player.select(drums);
    expect(mediaSession.metadata).toMatchObject({ data: { title: 'Шаманские барабаны', artist: 'medi' } });
    expect(mediaSession.playbackState).toBe('none');
  });
});
