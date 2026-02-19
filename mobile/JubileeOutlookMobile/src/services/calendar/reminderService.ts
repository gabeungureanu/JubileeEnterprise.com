/**
 * ReminderService — Local notification scheduling for calendar event reminders.
 *
 * Uses expo-notifications to schedule/cancel device-level notifications.
 * Works in Expo Go, Development Builds, and Production Builds (APNs/FCM).
 *
 * Key responsibilities:
 *   - Request notification permissions
 *   - Schedule a local notification N minutes before event start
 *   - Cancel an existing scheduled notification
 *   - Reschedule (cancel + schedule) when event is updated
 *   - Track scheduled notification IDs via AsyncStorage
 */
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { CalendarEvent } from '../../types/calendar';

// ── Storage keys ─────────────────────────────────────────────
const REMINDER_STORAGE_KEY = '@jubilee_reminder_ids';
const DISMISSED_STORAGE_KEY = '@jubilee_dismissed_reminders';

// ── Snooze durations (minutes) ────────────────────────────────
export const SNOOZE_OPTIONS = [
  { label: '5 minutes', minutes: 5 },
  { label: '10 minutes', minutes: 10 },
  { label: '15 minutes', minutes: 15 },
  { label: '30 minutes', minutes: 30 },
  { label: '1 hour', minutes: 60 },
  { label: '2 hours', minutes: 120 },
  { label: '4 hours', minutes: 240 },
  { label: '1 day', minutes: 1440 },
] as const;

// ── Types ────────────────────────────────────────────────────
interface ReminderRecord {
  eventId: string;
  notificationId: string;
  eventTitle: string;
  eventStart: string;
  reminderMinutes: number;
  scheduledFor: string; // ISO string — when the notification fires
}

// ── Configure notification handler ───────────────────────────
// This tells the OS how to present local notifications when the app is in foreground.
// Note: The expo-notifications SDK 53+ warning about "remote notifications removed
// from Expo Go" does NOT affect local notifications — our reminders are fully local.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Safe fallback — handler may fail in restricted environments
}

// ── Helper: get stored reminder records ──────────────────────
async function getStoredReminders(): Promise<Record<string, ReminderRecord>> {
  try {
    const raw = await AsyncStorage.getItem(REMINDER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveStoredReminders(
  records: Record<string, ReminderRecord>,
): Promise<void> {
  await AsyncStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(records));
}

// ── Helper: dismissed reminders tracking ─────────────────────
// When a user dismisses a reminder, we store the eventId so that
// batch re-scheduling (e.g., on screen focus) doesn't re-create it.
// Each entry stores the event start time so we can auto-clean past events.

interface DismissedEntry {
  eventStart: string; // ISO string — used for auto-cleanup
}

async function getDismissedReminders(): Promise<Record<string, DismissedEntry>> {
  try {
    const raw = await AsyncStorage.getItem(DISMISSED_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveDismissedReminders(
  records: Record<string, DismissedEntry>,
): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(records));
}

// ── Service ──────────────────────────────────────────────────
export const reminderService = {
  /**
   * Request permission for local notifications.
   * Returns true if granted. Should be called once at app startup.
   */
  async requestPermissions(): Promise<boolean> {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  },

  /**
   * Schedule a local notification for a calendar event.
   * The notification fires `reminderMinutes` before the event start time.
   *
   * If a reminder is already scheduled for this event, it is cancelled first.
   * If the fire time is already past but the event hasn't started yet,
   * the notification fires immediately (5-second delay).
   */
  async scheduleReminder(event: CalendarEvent, force = false): Promise<string | null> {
    if (event.reminderMinutes <= 0) {
      console.log(`[Reminder] Skipped "${event.title}" — reminderMinutes=${event.reminderMinutes}`);
      return null;
    }

    // Check if this reminder was dismissed by the user (skip unless forced)
    if (!force) {
      const dismissed = await getDismissedReminders();
      if (dismissed[event.id]) {
        console.log(`[Reminder] Skipped "${event.title}" — previously dismissed`);
        return null;
      }
    }

    const eventStart = new Date(event.startDateTime);
    if (isNaN(eventStart.getTime())) {
      console.warn(`[Reminder] Skipped "${event.title}" — invalid startDateTime: "${event.startDateTime}"`);
      return null;
    }

    const now = Date.now();
    let fireAt = new Date(eventStart.getTime() - event.reminderMinutes * 60000);

    // If the event itself is already in the past, skip entirely
    if (eventStart.getTime() <= now) {
      console.log(`[Reminder] Skipped "${event.title}" — event already started/passed`);
      return null;
    }

    // If fire time is in the past but event hasn't started yet,
    // fire immediately (5-second delay) so the user still gets notified
    if (fireAt.getTime() <= now) {
      console.log(`[Reminder] "${event.title}" fire time was in the past — scheduling immediate (5s)`);
      fireAt = new Date(now + 5000);
    }

    // Cancel any existing reminder for this event
    await this.cancelReminder(event.id);

    // Build the notification content
    const timeStr = eventStart.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });

    console.log(`[Reminder] Scheduling "${event.title}" to fire at ${fireAt.toISOString()} (event starts ${event.startDateTime})`);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: event.isPrivate ? 'Private Event' : event.title,
        body: event.isAllDay
          ? 'All day event starting soon'
          : `Starts at ${timeStr}${event.location ? ` • ${event.location}` : ''}`,
        data: {
          eventId: event.id,
          type: 'calendar_reminder',
        },
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: 'calendar-reminders',
          color: '#ffbd59',
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });

    console.log(`[Reminder] Scheduled OK — notificationId=${notificationId}`);

    // Persist the mapping
    const records = await getStoredReminders();
    records[event.id] = {
      eventId: event.id,
      notificationId,
      eventTitle: event.title,
      eventStart: event.startDateTime,
      reminderMinutes: event.reminderMinutes,
      scheduledFor: fireAt.toISOString(),
    };
    await saveStoredReminders(records);

    return notificationId;
  },

  /**
   * Cancel a scheduled reminder for a specific event.
   */
  async cancelReminder(eventId: string): Promise<void> {
    const records = await getStoredReminders();
    const record = records[eventId];
    if (record) {
      try {
        await Notifications.cancelScheduledNotificationAsync(record.notificationId);
      } catch {
        // Notification may have already fired or expired
      }
      delete records[eventId];
      await saveStoredReminders(records);
    }
  },

  /**
   * Snooze: schedule a follow-up notification N minutes from now.
   */
  async snoozeReminder(event: CalendarEvent, snoozeMinutes: number): Promise<string | null> {
    const fireAt = new Date(Date.now() + snoozeMinutes * 60000);

    // Cancel any existing
    await this.cancelReminder(event.id);

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Snoozed: ${event.isPrivate ? 'Private Event' : event.title}`,
        body: `Reminder snoozed for ${snoozeMinutes >= 60 ? `${snoozeMinutes / 60} hour${snoozeMinutes > 60 ? 's' : ''}` : `${snoozeMinutes} minutes`}`,
        data: {
          eventId: event.id,
          type: 'calendar_reminder_snoozed',
        },
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: 'calendar-reminders',
          color: '#ffbd59',
        }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireAt,
      },
    });

    // Update stored record
    const records = await getStoredReminders();
    records[event.id] = {
      eventId: event.id,
      notificationId,
      eventTitle: event.title,
      eventStart: event.startDateTime,
      reminderMinutes: event.reminderMinutes,
      scheduledFor: fireAt.toISOString(),
    };
    await saveStoredReminders(records);

    return notificationId;
  },

  /**
   * Dismiss: cancel the reminder, remove from scheduled storage,
   * and add to dismissed list so batch re-scheduling won't resurrect it.
   */
  async dismissReminder(eventId: string, eventStart?: string): Promise<void> {
    await this.cancelReminder(eventId);

    // Mark as dismissed so scheduleRemindersForEvents won't re-schedule
    const dismissed = await getDismissedReminders();
    dismissed[eventId] = { eventStart: eventStart || new Date().toISOString() };
    await saveDismissedReminders(dismissed);
    console.log(`[Reminder] Dismissed and blocked re-schedule for event ${eventId}`);
  },

  /**
   * Schedule reminders for a batch of events (e.g., on app start or after data fetch).
   * Only schedules if the fire time is in the future.
   */
  async scheduleRemindersForEvents(events: CalendarEvent[]): Promise<void> {
    let scheduled = 0;
    let skipped = 0;
    for (const event of events) {
      if (event.reminderMinutes > 0) {
        const result = await this.scheduleReminder(event);
        if (result) scheduled++;
        else skipped++;
      }
    }
    console.log(`[Reminder] Batch: ${scheduled} scheduled, ${skipped} skipped, ${events.length} total events`);
  },

  /**
   * Cancel all scheduled reminders and clear dismissed list (e.g., on logout).
   */
  async cancelAllReminders(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.removeItem(REMINDER_STORAGE_KEY);
    await AsyncStorage.removeItem(DISMISSED_STORAGE_KEY);
  },

  /**
   * Get all currently stored reminder records.
   */
  async getScheduledReminders(): Promise<ReminderRecord[]> {
    const records = await getStoredReminders();
    return Object.values(records);
  },

  /**
   * Remove a specific event from the dismissed list.
   * Called when a user explicitly re-enables a reminder (e.g., edits the event).
   */
  async undismiss(eventId: string): Promise<void> {
    const dismissed = await getDismissedReminders();
    if (dismissed[eventId]) {
      delete dismissed[eventId];
      await saveDismissedReminders(dismissed);
    }
  },

  /**
   * Clean up dismissed entries for events that are now in the past.
   * Call periodically to prevent the dismissed list from growing forever.
   */
  async cleanupDismissed(): Promise<void> {
    const dismissed = await getDismissedReminders();
    const now = Date.now();
    let changed = false;
    for (const [id, entry] of Object.entries(dismissed)) {
      const start = new Date(entry.eventStart).getTime();
      if (!isNaN(start) && start < now) {
        delete dismissed[id];
        changed = true;
      }
    }
    if (changed) await saveDismissedReminders(dismissed);
  },

  /**
   * Set up Android notification channel (required for Android 8+).
   * Call once at app initialization.
   */
  async setupAndroidChannel(): Promise<void> {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('calendar-reminders', {
        name: 'Calendar Reminders',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#ffbd59',
        sound: 'default',
      });
    }
  },
};
