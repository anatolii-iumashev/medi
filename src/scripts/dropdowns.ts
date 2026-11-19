const DROPDOWN_SELECTOR = 'details[data-player-dropdown]';

function findOpen(dropdowns: readonly HTMLDetailsElement[]): HTMLDetailsElement | undefined {
  return dropdowns.find((dropdown) => dropdown.open);
}

function close(dropdown: HTMLDetailsElement, focusSummary = false): void {
  if (!dropdown.open) return;
  dropdown.open = false;
  if (focusSummary) dropdown.querySelector<HTMLElement>('summary')?.focus();
}

/**
 * Keeps the player's native `details` panels mutually exclusive, dismisses them
 * on outside interaction and Escape, and returns focus after a choice. It does
 * not know about audio or the player state.
 */
export function initDropdowns(root: ParentNode = document): void {
  const dropdowns = Array.from(root.querySelectorAll<HTMLDetailsElement>(DROPDOWN_SELECTOR));
  if (dropdowns.length === 0) return;

  for (const dropdown of dropdowns) {
    dropdown.addEventListener('toggle', () => {
      if (!dropdown.open) return;
      for (const other of dropdowns) {
        if (other !== dropdown) close(other);
      }
    });
    dropdown.addEventListener('change', () => close(dropdown, true));
  }

  document.addEventListener('pointerdown', (event) => {
    const open = findOpen(dropdowns);
    if (!open) return;
    if (event.target instanceof Node && open.contains(event.target)) return;
    close(open);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = findOpen(dropdowns);
    if (!open) return;
    event.preventDefault();
    close(open, true);
  });
}
