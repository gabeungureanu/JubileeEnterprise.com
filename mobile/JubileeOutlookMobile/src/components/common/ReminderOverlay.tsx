/**
 * ReminderOverlay — Connects ReminderContext to ReminderPopup.
 *
 * Place this at the app root (inside ReminderProvider).
 * When a reminder fires, this shows the popup with dismiss/snooze controls.
 */
import React, { useCallback } from 'react';
import { useReminders } from '../../context/ReminderContext';
import { ReminderPopup } from './ReminderPopup';

export const ReminderOverlay: React.FC = () => {
  const { activeReminder, dismissReminder, snoozeReminder } = useReminders();

  const handleSnooze = useCallback(
    (minutes: number) => {
      snoozeReminder(minutes);
    },
    [snoozeReminder],
  );

  return (
    <ReminderPopup
      reminder={activeReminder}
      onDismiss={dismissReminder}
      onSnooze={handleSnooze}
    />
  );
};
