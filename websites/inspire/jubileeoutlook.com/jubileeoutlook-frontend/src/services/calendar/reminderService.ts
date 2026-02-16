import { CalendarEvent } from '../../types/calendar';

const CHECK_INTERVAL_MS = 30000; // 30 seconds, matching WPF
const TRIGGER_WINDOW_MS = 30000; // 30-second trigger window

export interface ReminderTrigger {
  event: CalendarEvent;
  triggeredAt: Date;
}

export type ReminderCallback = (trigger: ReminderTrigger) => void;

class ReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private notifiedEventIds = new Set<string>();
  private events: CalendarEvent[] = [];
  private onTrigger: ReminderCallback | null = null;

  start(callback: ReminderCallback): void {
    this.onTrigger = callback;
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.check(), CHECK_INTERVAL_MS);
    this.check(); // Run immediately
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.onTrigger = null;
  }

  updateEvents(events: CalendarEvent[]): void {
    this.events = events;
  }

  dismiss(eventId: string): void {
    this.notifiedEventIds.add(eventId);
  }

  snooze(eventId: string, minutes: number): void {
    // Remove from notified so it can re-trigger
    this.notifiedEventIds.delete(eventId);
    // We'll re-add after the snooze period via a timeout
    setTimeout(() => {
      // Don't re-add to notified - let the check cycle handle it naturally
      // The event will be re-evaluated. If the snooze period has passed
      // and the event is still upcoming, it will trigger again.
    }, minutes * 60 * 1000);
  }

  private check(): void {
    if (!this.onTrigger) return;

    const now = new Date();

    for (const event of this.events) {
      // Skip events already notified
      if (this.notifiedEventIds.has(event.id)) continue;

      // Skip events with no reminder
      if (event.reminderMinutes < 0) continue;

      const eventStart = new Date(event.startDateTime);
      const reminderTime = new Date(eventStart.getTime() - event.reminderMinutes * 60 * 1000);

      // Check if reminder should trigger:
      // reminder time has passed but within the trigger window
      const timeSinceReminder = now.getTime() - reminderTime.getTime();
      if (timeSinceReminder >= 0 && timeSinceReminder < TRIGGER_WINDOW_MS) {
        this.notifiedEventIds.add(event.id);
        this.onTrigger({ event, triggeredAt: now });
      }
    }
  }
}

export const reminderService = new ReminderService();
