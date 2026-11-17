export interface PlayerElements {
  toggle: HTMLButtonElement;
  status: HTMLElement;
  indicator: HTMLElement;
}

interface AudioTarget extends EventTarget {
  paused: boolean;
  currentTime: number;
  loop: boolean;
  play(): Promise<void>;
  pause(): void;
}

export class MeditationPlayer {
  private startPending = false;
  private manuallyStopped = false;

  constructor(
    private readonly audio: AudioTarget,
    private readonly elements: PlayerElements,
    private readonly mediaSession: MediaSession | undefined,
    artwork: MediaImage[] = [],
  ) {
    this.audio.loop = true;
    this.audio.addEventListener('play', this.handlePlay);
    this.audio.addEventListener('pause', this.handlePause);
    this.audio.addEventListener('waiting', this.handleWaiting);
    this.audio.addEventListener('canplay', this.handleCanPlay);
    this.audio.addEventListener('error', this.handleError);
    this.elements.toggle.addEventListener('click', this.handleToggle);
    this.configureMediaSession(artwork);
    this.render('Начать', 'Загружаем практику…', 'loading');
  }

  async toggle(): Promise<void> {
    if (this.audio.paused) {
      await this.start();
    } else {
      this.stop();
    }
  }

  stop(): void {
    this.manuallyStopped = true;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.render('Начать', 'Остановлено. Нажмите «Начать», чтобы начать сначала.', 'stopped');
    if (this.mediaSession) this.mediaSession.playbackState = 'none';
  }

  private async start(): Promise<void> {
    if (this.startPending) return;
    this.startPending = true;
    this.manuallyStopped = false;
    this.render('Начать', 'Подключаем аудио…', 'loading');
    try {
      await this.audio.play();
    } catch {
      this.render('Начать', 'Не удалось начать. Проверьте доступность аудио и нажмите ещё раз.', 'error');
    } finally {
      this.startPending = false;
    }
  }

  private render(label: string, message: string, state: string): void {
    this.elements.toggle.textContent = label;
    this.elements.toggle.setAttribute('aria-label', label);
    this.elements.status.textContent = message;
    this.elements.indicator.className = `status status-${state === 'error' ? 'error' : state === 'playing' ? 'success' : 'neutral'}`;
    this.elements.indicator.dataset.state = state;
  }

  private handleToggle = (): void => {
    void this.toggle();
  };

  private handlePlay = (): void => {
    this.render('Стоп', 'Медитация звучит', 'playing');
    if (this.mediaSession) this.mediaSession.playbackState = 'playing';
  };

  private handlePause = (): void => {
    if (!this.manuallyStopped) {
      this.render('Начать', 'Пауза. Нажмите «Начать», чтобы продолжить.', 'paused');
    }
    if (this.mediaSession) this.mediaSession.playbackState = 'paused';
  };

  private handleWaiting = (): void => {
    if (!this.audio.paused) this.render('Стоп', 'Подключаем аудио…', 'loading');
  };

  private handleCanPlay = (): void => {
    if (!this.audio.paused) {
      this.handlePlay();
    } else if (!this.manuallyStopped) {
      this.render('Начать', 'Практика готова. Найдите удобное положение.', 'ready');
    }
  };

  private handleError = (): void => {
    this.startPending = false;
    this.manuallyStopped = false;
    this.render('Начать', 'Аудио недоступно. Откройте приложение один раз онлайн и попробуйте снова.', 'error');
    if (this.mediaSession) this.mediaSession.playbackState = 'none';
  };

  private configureMediaSession(artwork: MediaImage[]): void {
    if (!this.mediaSession) return;
    if (typeof MediaMetadata !== 'undefined') {
      this.mediaSession.metadata = new MediaMetadata({
        title: 'Тихое дыхание',
        artist: 'Medi',
        album: 'Медитация для спокойствия',
        artwork,
      });
    }
    this.setActionHandler('play', () => void this.start());
    this.setActionHandler('pause', () => this.audio.pause());
    this.setActionHandler('stop', () => this.stop());
  }

  private setActionHandler(action: MediaSessionAction, handler: MediaSessionActionHandler): void {
    try {
      this.mediaSession?.setActionHandler(action, handler);
    } catch {
      return;
    }
  }
}

export function initPlayer(): void {
  const audio = document.querySelector<HTMLAudioElement>('[data-player-audio]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-player-toggle]');
  const status = document.querySelector<HTMLElement>('[data-player-status]');
  const indicator = document.querySelector<HTMLElement>('[data-player-indicator]');
  if (!audio || !toggle || !status || !indicator) return;
  const artwork = [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }];
  new MeditationPlayer(audio, { toggle, status, indicator }, navigator.mediaSession, artwork);
}
