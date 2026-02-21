/**
 * ReminderContext — App-wide reminder state management.
 *
 * Handles:
 *   - Listening for incoming notifications (foreground + background tap)
 *   - Showing in-app reminder popup when notification fires while app is open
 *   - Snooze / dismiss lifecycle
 *   - Auto-scheduling reminders when events are fetched
 *   - Requesting permissions on mount
 *   - Setting up Android notification channel
 */
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import * as Notifications from 'expo-notifications';
import { NavigationContainerRef } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reminderService } from '../services/calendar/reminderService';
import { calendarService } from '../services/calendar/calendarService';
import type { CalendarEvent } from '../types/calendar';

const DISMISSED_STORAGE_KEY = '@jubilee_dismissed_reminders';

// ── Types ────────────────────────────────────────────────────

export interface ActiveReminder {
  eventId: string;
  eventTitle: string;
  eventStart: string;
  eventLocation?: string;
  isAllDay?: boolean;
  isPrivate?: boolean;
}

interface ReminderContextValue {
  /** Currently showing in-app reminder (null if none) */
  activeReminder: ActiveReminder | null;
  /** Dismiss the current in-app reminder */
  dismissReminder: () => void;
  /** Snooze the current in-app reminder */
  snoozeReminder: (minutes: number) => void;
  /** Schedule a reminder for an event */
  scheduleForEvent: (event: CalendarEvent) => Promise<void>;
  /** Cancel a reminder for an event */
  cancelForEvent: (eventId: string) => Promise<void>;
  /** Whether notification permissions are granted */
  hasPermission: boolean;
}

const ReminderContext = createContext<ReminderContextValue | undefined>(undefined);

// ── Navigation ref (set from App.tsx) ────────────────────────
let navigationRef: NavigationContainerRef<any> | null = null;

export function setReminderNavigationRef(ref: NavigationContainerRef<any> | null) {
  navigationRef = ref;
}

// ── Provider ─────────────────────────────────────────────────

export const ReminderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeReminder, setActiveReminder] = useState<ActiveReminder | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const activeEventRef = useRef<CalendarEvent | null>(null);

  // ── Initialize on mount ────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        // Set up Android channel
        await reminderService.setupAndroidChannel();

        // Request permissions (local notifications work in Expo Go;
        // the SDK 53+ warning is about remote/push only)
        const granted = await reminderService.requestPermissions();
        setHasPermission(granted);

        // Clean up dismissed entries for past events
        await reminderService.cleanupDismissed();
      } catch {
        // Graceful fallback — reminders won't fire but app won't crash
        setHasPermission(false);
      }
    }
    init();
  }, []);

  // ── Listen for foreground notifications ────────────────────
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const data = notification.request.content.data;
        if (
          data?.type === 'calendar_reminder' ||
          data?.type === 'calendar_reminder_snoozed'
        ) {
          // Check if this event was dismissed — never show again if so
          try {
            const raw = await AsyncStorage.getItem(DISMISSED_STORAGE_KEY);
            const dismissed = raw ? JSON.parse(raw) : {};
            if (dismissed[data.eventId as string]) return;
          } catch { /* continue */ }

          // Fetch fresh event data for the popup
          try {
            const event = await calendarService.getEvent(data.eventId as string);
            if (event) {
              activeEventRef.current = event;
              setActiveReminder({
                eventId: event.id,
                eventTitle: event.isPrivate ? 'Private Event' : event.title,
                eventStart: event.startDateTime,
                eventLocation: event.location || undefined,
                isAllDay: event.isAllDay,
                isPrivate: event.isPrivate,
              });
            }
          } catch {
            // If we can't fetch, show with notification content
            setActiveReminder({
              eventId: data.eventId as string,
              eventTitle: notification.request.content.title || 'Event Reminder',
              eventStart: '',
              isPrivate: false,
            });
          }
        }
      },
    );

    return () => subscription.remove();
  }, []);

  // ── Listen for notification taps (background → open event) ─
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data;
        if (
          data?.type === 'calendar_reminder' ||
          data?.type === 'calendar_reminder_snoozed'
        ) {
          const eventId = data.eventId as string;

          // Check if this event was dismissed — never show again if so
          try {
            const raw = await AsyncStorage.getItem(DISMISSED_STORAGE_KEY);
            const dismissed = raw ? JSON.parse(raw) : {};
            if (dismissed[eventId]) return;
          } catch { /* continue */ }

          // Try to fetch the event and navigate to detail
          try {
            const event = await calendarService.getEvent(eventId);
            if (event && navigationRef) {
              // Show popup + navigate
              activeEventRef.current = event;
              setActiveReminder({
                eventId: event.id,
                eventTitle: event.isPrivate ? 'Private Event' : event.title,
                eventStart: event.startDateTime,
                eventLocation: event.location || undefined,
                isAllDay: event.isAllDay,
                isPrivate: event.isPrivate,
              });
            }
          } catch {
            // Silent fail — at least show the popup
            setActiveReminder({
              eventId,
              eventTitle: response.notification.request.content.title || 'Event Reminder',
              eventStart: '',
            });
          }
        }
      },
    );

    return () => subscription.remove();
  }, []);

  // ── Dismiss ────────────────────────────────────────────────
  const dismissReminder = useCallback(() => {
    if (activeReminder) {
      reminderService.dismissReminder(activeReminder.eventId, activeReminder.eventStart);
    }
    setActiveReminder(null);
    activeEventRef.current = null;
  }, [activeReminder]);

  // ── Snooze ─────────────────────────────────────────────────
  const snoozeReminder = useCallback(
    (minutes: number) => {
      if (activeEventRef.current) {
        // Remove from dismissed list so the snoozed notification is allowed
        reminderService.undismiss(activeEventRef.current.id);
        reminderService.snoozeReminder(activeEventRef.current, minutes);
      }
      setActiveReminder(null);
      activeEventRef.current = null;
    },
    [],
  );

  // ── Schedule for a single event ────────────────────────────
  const scheduleForEvent = useCallback(async (event: CalendarEvent) => {
    if (event.reminderMinutes > 0) {
      await reminderService.scheduleReminder(event);
    }
  }, []);

  // ── Cancel for a single event ──────────────────────────────
  const cancelForEvent = useCallback(async (eventId: string) => {
    await reminderService.cancelReminder(eventId);
  }, []);

  return (
    <ReminderContext.Provider
      value={{
        activeReminder,
        dismissReminder,
        snoozeReminder,
        scheduleForEvent,
        cancelForEvent,
        hasPermission,
      }}
    >
      {children}
    </ReminderContext.Provider>
  );
};

// ── Hook ─────────────────────────────────────────────────────

export const useReminders = (): ReminderContextValue => {
  const context = useContext(ReminderContext);
  if (!context) {
    throw new Error('useReminders must be used within a ReminderProvider');
  }
  return context;
};
