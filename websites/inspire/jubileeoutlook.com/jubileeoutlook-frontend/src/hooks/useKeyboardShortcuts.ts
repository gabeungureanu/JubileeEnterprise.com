import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutActions {
  onNewEvent: () => void;
  onToday: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onViewDay: () => void;
  onViewWorkWeek: () => void;
  onViewWeek: () => void;
  onViewMonth: () => void;
  onFocusSearch: () => void;
  onCloseDialog?: () => void;
}

export function useKeyboardShortcuts(
  actions: KeyboardShortcutActions,
  enabled: boolean = true
): void {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Skip when inside text inputs/textareas/selects
    const target = e.target as HTMLElement;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target.isContentEditable
    ) {
      // Only handle Escape inside inputs
      if (e.key === 'Escape' && actions.onCloseDialog) {
        actions.onCloseDialog();
      }
      return;
    }

    const mod = e.ctrlKey || e.metaKey;

    switch (e.key) {
      // Ctrl/Cmd + N: New event
      case 'n':
      case 'N':
        if (mod) {
          e.preventDefault();
          actions.onNewEvent();
        }
        break;

      // T: Go to today
      case 't':
      case 'T':
        if (!mod) {
          e.preventDefault();
          actions.onToday();
        }
        break;

      // Arrow Left: Previous period
      case 'ArrowLeft':
        if (!mod) {
          e.preventDefault();
          actions.onPrevious();
        }
        break;

      // Arrow Right: Next period
      case 'ArrowRight':
        if (!mod) {
          e.preventDefault();
          actions.onNext();
        }
        break;

      // 1: Day view
      case '1':
        if (!mod) {
          e.preventDefault();
          actions.onViewDay();
        }
        break;

      // 2: Work Week view
      case '2':
        if (!mod) {
          e.preventDefault();
          actions.onViewWorkWeek();
        }
        break;

      // 3: Week view
      case '3':
        if (!mod) {
          e.preventDefault();
          actions.onViewWeek();
        }
        break;

      // 4: Month view
      case '4':
        if (!mod) {
          e.preventDefault();
          actions.onViewMonth();
        }
        break;

      // Ctrl/Cmd + F: Focus search
      case 'f':
      case 'F':
        if (mod) {
          e.preventDefault();
          actions.onFocusSearch();
        }
        break;

      // Escape: Close dialog
      case 'Escape':
        if (actions.onCloseDialog) {
          actions.onCloseDialog();
        }
        break;
    }
  }, [actions, enabled]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
