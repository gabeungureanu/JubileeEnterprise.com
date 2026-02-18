import { CalendarEvent } from '../../types/calendar';

const CHECK_INTERVAL_MS = 15000; // 15 seconds for more reliable detection
const TRIGGER_WINDOW_MS = 10 * 60 * 1000; // 10-minute catch-up window
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

function getTimeUntilEvent(event: CalendarEvent): string {
  const now = new Date();
  const start = new Date(event.startDateTime);
  const diffMs = start.getTime() - now.getTime();

  if (diffMs <= 0) return 'Starting now';

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Less than a minute';
  if (diffMin === 1) return 'In 1 minute';
  if (diffMin < 60) return `In ${diffMin} minutes`;

  const diffHours = Math.floor(diffMin / 60);
  const remainingMin = diffMin % 60;
  if (diffHours === 1) return remainingMin > 0 ? `In 1 hour ${remainingMin} min` : 'In 1 hour';
  return remainingMin > 0 ? `In ${diffHours} hours ${remainingMin} min` : `In ${diffHours} hours`;
}

class ReminderService {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private notifiedEventIds = new Set<string>();
  private snoozedUntil = new Map<string, number>(); // eventId -> timestamp when snooze expires
  private events: CalendarEvent[] = [];
  private onTrigger: ReminderCallback | null = null;
  private handleVisibility: (() => void) | null = null;
  private notificationPermission: NotificationPermission = 'default';

  constructor() {
    this.loadDismissed();
    if (typeof Notification !== 'undefined') {
      this.notificationPermission = Notification.permission;
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof Notification === 'undefined') return 'denied';
    if (Notification.permission === 'granted') {
      this.notificationPermission = 'granted';
      return 'granted';
    }
    if (Notification.permission === 'denied') {
      this.notificationPermission = 'denied';
      return 'denied';
    }
    const result = await Notification.requestPermission();
    this.notificationPermission = result;
    return result;
  }

  private sendBrowserNotification(event: CalendarEvent): void {
    if (this.notificationPermission !== 'granted') return;

    const timeText = getTimeUntilEvent(event);
    const title = event.isPrivate ? 'Private Event' : event.title;

    const body = [
      timeText,
      event.location ? `Location: ${event.location}` : '',
    ].filter(Boolean).join('\n');

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: `reminder-${event.id}`,
      requireInteraction: true,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
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

    // Re-check when tab becomes visible again (browsers throttle timers in background tabs)
    this.handleVisibility = () => {
      if (document.visibilityState === 'visible') this.check();
    };
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.handleVisibility) {
      document.removeEventListener('visibilitychange', this.handleVisibility);
      this.handleVisibility = null;
    }
    this.onTrigger = null;
  }

  updateEvents(events: CalendarEvent[]): void {
    // Clear dismissed state for new or modified events so reminders can re-fire
    const oldEventMap = new Map(this.events.map(e => [e.id, e]));
    for (const event of events) {
      const old = oldEventMap.get(event.id);
      if (!old) {
        // New event — make sure it's not in dismissed list
        this.notifiedEventIds.delete(event.id);
      } else if (
        old.startDateTime !== event.startDateTime ||
        old.reminderMinutes !== event.reminderMinutes
      ) {
        // Event was modified — reset so reminder can fire again
        this.notifiedEventIds.delete(event.id);
      }
    }
    this.saveDismissed();
    this.events = events;
    this.check(); // Immediately check for reminders with new/updated events
  }

  dismiss(eventId: string): void {
    this.notifiedEventIds.add(eventId);
    this.saveDismissed();
  }

  snooze(eventId: string, minutes: number): void {
    // Remove from notified so it can re-trigger after snooze period
    this.notifiedEventIds.delete(eventId);
    this.saveDismissed();
    // Track snooze expiry so check() won't re-trigger too early
    this.snoozedUntil.set(eventId, Date.now() + minutes * 60 * 1000);
  }

  private check(): void {
    if (!this.onTrigger) return;

    const now = new Date();
    const nowMs = now.getTime();

    for (const event of this.events) {
      // Skip events already notified/dismissed
      if (this.notifiedEventIds.has(event.id)) continue;

      // Skip events with no reminder
      if (event.reminderMinutes == null || event.reminderMinutes < 0) continue;

      // Skip events still snoozed
      const snoozeExpiry = this.snoozedUntil.get(event.id);
      if (snoozeExpiry && nowMs < snoozeExpiry) continue;
      // Clean up expired snooze entry
      if (snoozeExpiry) this.snoozedUntil.delete(event.id);

      const eventStart = new Date(event.startDateTime);
      const reminderTime = new Date(eventStart.getTime() - event.reminderMinutes * 60 * 1000);

      // Check if reminder should trigger:
      // reminder time has passed but within the trigger window
      const timeSinceReminder = nowMs - reminderTime.getTime();

      if (timeSinceReminder >= -60000 && timeSinceReminder < TRIGGER_WINDOW_MS) {
        this.notifiedEventIds.add(event.id);
        this.saveDismissed();
        this.sendBrowserNotification(event);
        this.onTrigger({ event, triggeredAt: now });
      }
    }
  }
}

export const reminderService = new ReminderService();
