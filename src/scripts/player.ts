import { DEFAULT_PRACTICE, PRACTICES, type Practice } from './practices';

export interface PlayerElements {
  toggle: HTMLButtonElement;
  status: HTMLElement;
  indicator: HTMLElement;
}

interface AudioTarget extends EventTarget {
  paused: boolean;
  currentTime: number;
  loop: boolean;
  src: string;
  play(): Promise<void>;
  pause(): void;
  load?(): void;
}

export class MeditationPlayer {
  private startPending = false;
  private manuallyStopped = false;
  private awaitingLoad = false;
  private generation = 0;
  private current: Practice;

  constructor(
    private readonly audio: AudioTarget,
    private readonly elements: PlayerElements,
    private readonly mediaSession: MediaSession | undefined,
    private readonly artwork: MediaImage[] = [],
    initial: Practice = DEFAULT_PRACTICE,
  ) {
    this.current = initial;
    this.audio.loop = true;
    this.audio.addEventListener('play', this.handlePlay);
    this.audio.addEventListener('pause', this.handlePause);
    this.audio.addEventListener('waiting', this.handleWaiting);
    this.audio.addEventListener('canplay', this.handleCanPlay);
    this.audio.addEventListener('error', this.handleError);
    this.elements.toggle.addEventListener('click', this.handleToggle);
    this.audio.src = initial.src;
    this.audio.load?.();
    this.configureMediaSession();
    this.render('Начать', this.loadingMessage(), 'loading');
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
    this.awaitingLoad = false;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.render('Начать', 'Остановлено. Нажмите «Начать», чтобы начать сначала.', 'stopped');
    this.setPlaybackState('none');
  }

  select(practice: Practice): void {
    if (this.current.id === practice.id) return;
    this.generation += 1;
    this.current = practice;
    this.startPending = false;
    this.manuallyStopped = true;
    this.awaitingLoad = true;
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.src = practice.src;
    this.audio.load?.();
    this.updateMetadata();
    this.setPlaybackState('none');
    this.render('Начать', this.loadingMessage(), 'loading');
  }

  private async start(): Promise<void> {
    if (this.startPending) return;
    const generation = this.generation;
    this.startPending = true;
    this.manuallyStopped = false;
    this.render('Начать', `Подключаем «${this.current.title}»…`, 'loading');
    try {
      await this.audio.play();
    } catch {
      if (generation === this.generation) {
        this.render('Начать', this.errorMessage(), 'error');
      }
    } finally {
      if (generation === this.generation) this.startPending = false;
    }
  }

  private loadingMessage(): string {
    return `Загружаем «${this.current.title}»…`;
  }

  private readyMessage(): string {
    return `Можно начинать: «${this.current.title}».`;
  }

  private errorMessage(): string {
    return `Аудио «${this.current.title}» недоступно. Откройте приложение один раз онлайн и попробуйте снова.`;
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
    this.awaitingLoad = false;
    this.render('Стоп', `Звучит: «${this.current.title}».`, 'playing');
    this.setPlaybackState('playing');
  };

  private handlePause = (): void => {
    if (this.manuallyStopped) return;
    this.render('Начать', 'Пауза. Нажмите «Начать», чтобы продолжить.', 'paused');
    this.setPlaybackState('paused');
  };

  private handleWaiting = (): void => {
    if (!this.audio.paused) this.render('Стоп', 'Подключаем аудио…', 'loading');
  };

  private handleCanPlay = (): void => {
    if (!this.audio.paused) {
      this.handlePlay();
      return;
    }
    if (this.awaitingLoad) {
      this.awaitingLoad = false;
      this.render('Начать', this.readyMessage(), 'ready');
    } else if (!this.manuallyStopped) {
      this.render('Начать', this.readyMessage(), 'ready');
    }
  };

  private handleError = (): void => {
    this.startPending = false;
    this.awaitingLoad = false;
    this.manuallyStopped = false;
    this.render('Начать', this.errorMessage(), 'error');
    this.setPlaybackState('none');
  };

  private setPlaybackState(state: MediaSessionPlaybackState): void {
    if (this.mediaSession) this.mediaSession.playbackState = state;
  }

  private updateMetadata(): void {
    if (!this.mediaSession || typeof MediaMetadata === 'undefined') return;
    this.mediaSession.metadata = new MediaMetadata({
      title: this.current.title,
      artist: 'medi',
      album: 'Медитация для спокойствия',
      artwork: this.artwork,
    });
  }

  private configureMediaSession(): void {
    if (!this.mediaSession) return;
    this.updateMetadata();
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
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-player-practice]'));
  const checkedId = inputs.find((input) => input.checked)?.value;
  const initial = PRACTICES.find((practice) => practice.id === checkedId) ?? DEFAULT_PRACTICE;
  const artwork = [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }];
  const player = new MeditationPlayer(audio, { toggle, status, indicator }, navigator.mediaSession, artwork, initial);

  for (const input of inputs) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const practice = PRACTICES.find((candidate) => candidate.id === input.value);
      if (practice) player.select(practice);
    });
  }
}
