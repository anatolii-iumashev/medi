import {
  DEFAULT_PRACTICE,
  DEFAULT_SESSION_DURATION,
  PRACTICES,
  isSessionDuration,
  type Practice,
  type SessionDuration,
} from './practices';
import { readDefaultPractice, writeDefaultPractice } from './preferences';

export interface PlayerElements {
  toggle: HTMLButtonElement;
  label?: HTMLElement;
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
  private selectedDuration: SessionDuration;
  private remainingMs: number;
  private deadline = 0;
  private sessionTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly audio: AudioTarget,
    private readonly elements: PlayerElements,
    private readonly mediaSession: MediaSession | undefined,
    private readonly artwork: MediaImage[] = [],
    initial: Practice = DEFAULT_PRACTICE,
    initialDuration: number = DEFAULT_SESSION_DURATION,
  ) {
    this.current = initial;
    this.selectedDuration = isSessionDuration(initialDuration) ? initialDuration : DEFAULT_SESSION_DURATION;
    this.remainingMs = this.fullSessionMs();
    this.audio.loop = true;
    this.audio.addEventListener('play', this.handlePlay);
    this.audio.addEventListener('pause', this.handlePause);
    this.audio.addEventListener('waiting', this.handleWaiting);
    this.audio.addEventListener('canplay', this.handleCanPlay);
    this.audio.addEventListener('error', this.handleError);
    this.audio.addEventListener('timeupdate', this.handleTimeUpdate);
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
    this.generation += 1;
    this.startPending = false;
    this.manuallyStopped = true;
    this.awaitingLoad = false;
    this.resetSession();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.render('Начать', 'Остановлено. Нажмите «Начать», чтобы начать сначала.', 'stopped');
    this.setPlaybackState('none');
  }

  select(practice: Practice, duration: number = this.selectedDuration): void {
    const nextDuration = practice.sessionDurations
      ? isSessionDuration(duration) && practice.sessionDurations.includes(duration)
        ? duration
        : DEFAULT_SESSION_DURATION
      : this.selectedDuration;
    if (this.current.id === practice.id && this.selectedDuration === nextDuration) return;

    this.generation += 1;
    this.current = practice;
    this.selectedDuration = nextDuration;
    this.startPending = false;
    this.manuallyStopped = true;
    this.awaitingLoad = true;
    this.resetSession();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.audio.loop = true;
    this.audio.src = practice.src;
    this.audio.load?.();
    this.updateMetadata();
    this.setPlaybackState('none');
    this.render('Начать', this.loadingMessage(), 'loading');
  }

  selectDuration(duration: number): void {
    if (!this.current.sessionDurations || !isSessionDuration(duration)) return;
    this.select(this.current, duration);
  }

  finishIfExpired = (): void => {
    if (this.sessionTimer === undefined || this.audio.paused) return;
    if (performance.now() >= this.deadline) this.finishSession();
  };

  private async start(): Promise<void> {
    if (this.startPending || !this.audio.paused) return;
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

  private fullSessionMs(): number {
    return this.selectedDuration * 60_000;
  }

  private resetSession(): void {
    this.clearSessionTimer();
    this.remainingMs = this.fullSessionMs();
  }

  private resumeSessionTimer(): void {
    if (!this.current.sessionDurations || this.sessionTimer !== undefined || this.manuallyStopped) return;
    if (this.remainingMs <= 0) {
      this.finishSession();
      return;
    }

    this.deadline = performance.now() + this.remainingMs;
    const generation = this.generation;
    this.sessionTimer = setTimeout(() => {
      if (generation !== this.generation || this.manuallyStopped) return;
      this.sessionTimer = undefined;
      this.finishSession();
    }, this.remainingMs);
  }

  private pauseSessionTimer(): void {
    if (this.sessionTimer === undefined) return;
    this.remainingMs = Math.max(0, this.deadline - performance.now());
    this.clearSessionTimer();
  }

  private clearSessionTimer(): void {
    if (this.sessionTimer !== undefined) clearTimeout(this.sessionTimer);
    this.sessionTimer = undefined;
    this.deadline = 0;
  }

  private finishSession(): void {
    this.generation += 1;
    this.startPending = false;
    this.manuallyStopped = true;
    this.awaitingLoad = false;
    this.resetSession();
    this.audio.pause();
    this.audio.currentTime = 0;
    this.render('Начать', 'Практика завершена. Нажмите «Начать», чтобы начать снова.', 'complete');
    this.setPlaybackState('none');
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
    const labelTarget = this.elements.label ?? this.elements.toggle;
    labelTarget.textContent = label;
    this.elements.toggle.setAttribute('aria-label', label);
    this.elements.toggle.dataset.state = state;
    this.elements.status.textContent = message;
    this.elements.indicator.className = `status status-${state === 'error' ? 'error' : state === 'playing' ? 'success' : 'neutral'}`;
    this.elements.indicator.dataset.state = state;
  }

  private handleToggle = (): void => {
    void this.toggle();
  };

  private handlePlay = (): void => {
    if (this.manuallyStopped) {
      this.audio.pause();
      return;
    }
    this.awaitingLoad = false;
    this.render('Стоп', `Звучит: «${this.current.title}».`, 'playing');
    this.setPlaybackState('playing');
    this.resumeSessionTimer();
  };

  private handlePause = (): void => {
    if (this.manuallyStopped) return;
    this.pauseSessionTimer();
    this.render('Начать', 'Пауза. Нажмите «Начать», чтобы продолжить.', 'paused');
    this.setPlaybackState('paused');
  };

  private handleWaiting = (): void => {
    if (!this.audio.paused) {
      this.pauseSessionTimer();
      this.render('Стоп', 'Подключаем аудио…', 'loading');
    }
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

  private handleTimeUpdate = (): void => {
    this.finishIfExpired();
  };

  private handleError = (): void => {
    this.startPending = false;
    this.awaitingLoad = false;
    this.manuallyStopped = false;
    this.pauseSessionTimer();
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
  const label = document.querySelector<HTMLElement>('[data-player-toggle-label]');
  const status = document.querySelector<HTMLElement>('[data-player-status]');
  const indicator = document.querySelector<HTMLElement>('[data-player-indicator]');
  if (!audio || !toggle || !status || !indicator) return;
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-player-practice]'));
  const durationGroup = document.querySelector<HTMLElement>('[data-player-durations]');
  const currentTitle = document.querySelector<HTMLElement>('[data-player-current-title]');
  const currentDescription = document.querySelector<HTMLElement>('[data-player-current-description]');
  const soundSummary = document.querySelector<HTMLElement>('[data-player-dropdown="sound"] > summary');
  const durationInputs = Array.from(document.querySelectorAll<HTMLInputElement>('[data-player-duration]'));
  const storedDefault = readDefaultPractice();
  if (storedDefault && inputs.some((input) => input.value === storedDefault)) {
    for (const input of inputs) input.checked = input.value === storedDefault;
  }
  const checkedId = inputs.find((input) => input.checked)?.value;
  const initial = PRACTICES.find((practice) => practice.id === checkedId) ?? DEFAULT_PRACTICE;
  const initialDuration = Number(durationInputs.find((input) => input.checked)?.value);
  const artwork = [{ src: `${import.meta.env.BASE_URL}icons/icon-512.png`, sizes: '512x512', type: 'image/png' }];
  const player = new MeditationPlayer(
    audio,
    { toggle, label: label ?? undefined, status, indicator },
    navigator.mediaSession,
    artwork,
    initial,
    initialDuration,
  );

  const renderPractice = (practice: Practice): void => {
    if (currentTitle) currentTitle.textContent = practice.title;
    if (currentDescription) currentDescription.textContent = practice.description;
    if (soundSummary) soundSummary.setAttribute('aria-label', `Звук: ${practice.title}`);
    if (durationGroup) durationGroup.hidden = !practice.sessionDurations;
  };

  renderPractice(initial);

  for (const input of inputs) {
    input.addEventListener('change', () => {
      if (!input.checked) return;
      const practice = PRACTICES.find((candidate) => candidate.id === input.value);
      if (practice) {
        player.select(practice);
        writeDefaultPractice(practice.id);
        renderPractice(practice);
      }
    });
  }

  for (const input of durationInputs) {
    input.addEventListener('change', () => {
      if (input.checked) player.selectDuration(Number(input.value));
    });
  }

  document.addEventListener('visibilitychange', player.finishIfExpired);
}
