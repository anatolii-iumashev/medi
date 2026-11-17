import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeditationPlayer } from '../src/scripts/player';

class FakeAudio extends EventTarget {
  paused = true;
  currentTime = 0;
  loop = false;
  play = vi.fn(async () => {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
  });
  pause = vi.fn(() => {
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  });
}

function setup() {
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
  );
  return { audio, toggle, status, indicator, handlers, mediaSession, player };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MeditationPlayer', () => {
  it('starts only after an explicit action and reflects the play event', async () => {
    const { audio, toggle, status, player } = setup();
    expect(audio.play).not.toHaveBeenCalled();
    await player.toggle();
    expect(toggle.textContent).toBe('Стоп');
    expect(status.textContent).toContain('звучит');
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
    expect(status.textContent).toContain('Не удалось начать');
  });

  it('reflects an external pause', async () => {
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
    expect(status.textContent).toContain('Аудио недоступно');
  });

  it('exposes media metadata and play, pause and stop actions', async () => {
    const { audio, handlers, mediaSession } = setup();
    expect(mediaSession.metadata).toMatchObject({ data: { title: 'Тихое дыхание', artist: 'Medi' } });
    expect([...handlers.keys()]).toEqual(['play', 'pause', 'stop']);
    await handlers.get('play')?.();
    expect(audio.paused).toBe(false);
    handlers.get('pause')?.();
    expect(audio.paused).toBe(true);
    audio.currentTime = 25;
    await handlers.get('stop')?.();
    expect(audio.currentTime).toBe(0);
  });
});

