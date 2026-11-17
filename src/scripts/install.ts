interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function initInstallPrompt(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-install-button]');
  const instructions = document.querySelector<HTMLElement>('[data-install-instructions]');
  if (!button || !instructions) return;

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isStandalone) {
    instructions.textContent = 'Приложение установлено. Практика доступна с домашнего экрана.';
    return;
  }

  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIos) instructions.textContent = 'В Safari откройте «Поделиться», затем «На экран “Домой”».';

  let promptEvent: BeforeInstallPromptEvent | undefined;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    promptEvent = event as BeforeInstallPromptEvent;
    button.hidden = false;
  });

  button.addEventListener('click', () => {
    void (async () => {
      if (!promptEvent) return;
      const currentPrompt = promptEvent;
      promptEvent = undefined;
      button.hidden = true;
      try {
        await currentPrompt.prompt();
        await currentPrompt.userChoice;
      } catch {
        instructions.textContent = 'Установку можно запустить из меню браузера.';
      }
    })();
  });

  window.addEventListener('appinstalled', () => {
    button.hidden = true;
    instructions.textContent = 'Приложение установлено. Практика доступна с домашнего экрана.';
  });
}
