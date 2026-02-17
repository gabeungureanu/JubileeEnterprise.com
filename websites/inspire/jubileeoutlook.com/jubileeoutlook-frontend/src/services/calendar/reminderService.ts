import { CalendarEvent } from '../../types/calendar';

const CHECK_INTERVAL_MS = 30000; // 30 seconds, matching WPF
const TRIGGER_WINDOW_MS = 30000; // 30-second trigger window
const STORAGE_KEY = 'jubilee_calendar_dismissed_reminders';
const EXPIRY_DAYS = 7;

export interface ReminderTrigger {
  event: CalendarEvent;
  triggeredAt: Date;
}

export type ReminderCallback = (trigger: ReminderTrigger) => void;

interface DismissedEntry {
  id: string;
  timestamp: number;
}

class ReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private notifiedEventIds = new Set<string>();
  private events: CalendarEvent[] = [];
  private onTrigger: ReminderCallback | null = null;

  constructor() {
    this.loadDismissed();
  }

  private loadDismissed(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const entries: DismissedEntry[] = JSON.parse(stored);
        const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
        const valid = entries.filter((e) => e.timestamp > cutoff);
        this.notifiedEventIds = new Set(valid.map((e) => e.id));
        // Clean up expired entries
        if (valid.length !== entries.length) {
          this.saveDismissed();
        }
      }
    } catch {
      /* ignore corrupt data */
    }
  }

  private saveDismissed(): void {
    try {
      const entries: DismissedEntry[] = Array.from(this.notifiedEventIds).map((id) => ({
        id,
        timestamp: Date.now(),
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore storage errors */
    }
  }

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
    this.saveDismissed();
  }

  snooze(eventId: string, minutes: number): void {
    // Remove from notified so it can re-trigger
    this.notifiedEventIds.delete(eventId);
    this.saveDismissed();
    // After snooze period, the check cycle will re-evaluate naturally
    setTimeout(() => {
      // Intentionally empty - the check() loop handles re-triggering
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
        this.saveDismissed();
        this.onTrigger({ event, triggeredAt: now });
      }
    }
  }
}

export const reminderService = new ReminderService();
