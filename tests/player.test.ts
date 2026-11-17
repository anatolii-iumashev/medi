import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeditationPlayer } from '../src/scripts/player';
import type { Practice } from '../src/scripts/practices';

const quiet: Practice = {
  id: 'quiet',
  title: 'Тихое дыхание',
  duration: '6 минут',
  src: '/medi/audio/meditation.mp3',
};

const drums: Practice = {
  id: 'drums',
  title: 'Шаманские барабаны',
  duration: '32 секунды',
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

function setup(initial: Practice = quiet) {
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
  vi.unstubAllGlobals();
});

describe('MeditationPlayer', () => {
  it('loads the selected practice without autoplay and keeps the loop', () => {
    const { audio, toggle, status } = setup();
    expect(audio.src).toBe(quiet.src);
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
    expect(status.textContent).toContain('Тихое дыхание');
    expect(audio.loop).toBe(true);
  });

  it('stops, rewinds and starts again from the beginning', async () => {
    const { audio, toggle, status, player } = setup();
    await player.toggle();
    audio.currentTime = 42;
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
    audio.currentTime = 18;
    audio.pause();
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('Пауза');
    expect(audio.currentTime).toBe(18);
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
    audio.currentTime = 21;
    player.select(drums);
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
    expect(audio.src).toBe(drums.src);
    expect(audio.load).toHaveBeenCalledTimes(2);
    expect(audio.play).toHaveBeenCalledOnce();
    expect(toggle.textContent).toBe('Начать');
    expect(status.textContent).toContain('Шаманские барабаны');
  });

  it('does not restart the active practice when it is selected again', async () => {
    const { audio, player } = setup();
    player.select(quiet);
    expect(audio.pause).not.toHaveBeenCalled();
    expect(audio.load).toHaveBeenCalledOnce();
    expect(audio.src).toBe(quiet.src);
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

  it('keeps the last practice after rapid switches', () => {
    const { audio, player } = setup();
    player.select(drums);
    player.select(quiet);
    player.select(drums);
    expect(audio.src).toBe(drums.src);
  });

  it('exposes media metadata and play, pause and stop actions', async () => {
    const { audio, handlers, mediaSession } = setup();
    expect(mediaSession.metadata).toMatchObject({ data: { title: 'Тихое дыхание', artist: 'medi' } });
    expect([...handlers.keys()]).toEqual(['play', 'pause', 'stop']);
    await handlers.get('play')?.();
    expect(audio.paused).toBe(false);
    handlers.get('pause')?.();
    expect(audio.paused).toBe(true);
    audio.currentTime = 25;
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
