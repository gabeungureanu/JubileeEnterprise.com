/**
 * CalendarScreen — Orchestrator for the calendar module.
 *
 * Manages view mode (Day / Week / Month), date navigation,
 * event fetching, collapsible month grid, and renders the
 * appropriate view component.
 *
 * Uses two date states:
 *   viewDate     — always valid; drives header title, month display, date range
 *   selectedDate — nullable; drives cell highlighting and event list filtering
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, LayoutAnimation, Platform, UIManager, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../constants/colors';
import { LoadingSpinner, FloatingActionButton } from '../../components/common';
import {
  CalendarHeader,
  MonthGrid,
  DayEventList,
  TimeGrid,
} from '../../components/modules/calendar';
import { useAlert } from '../../hooks';
import { calendarService } from '../../services/calendar/calendarService';
import { reminderService } from '../../services/calendar/reminderService';
import {
  isSameDay,
  getDateRange,
  expandRecurringEvents,
} from '../../utils/calendarUtils';
import type { CalendarEvent, CalendarViewMode } from '../../types/calendar';
import type { CalendarStackParamList } from '../../types/navigation';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = NativeStackNavigationProp<CalendarStackParamList, 'CalendarMain'>;

const CalendarScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { alert, AlertComponent } = useAlert();

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [viewDate, setViewDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);

  // ── Date range for current view ─────────────────────────
  const dateRange = useMemo(
    () => getDateRange(viewDate, viewMode),
    [viewDate, viewMode],
  );

  // ── Data fetching ───────────────────────────────────────
  const fetchEvents = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setIsLoading(true);
        setError(null);
        const data = await calendarService.getEvents(dateRange.start, dateRange.end);
        const expanded = expandRecurringEvents(data, dateRange.start, dateRange.end);
        setEvents(expanded);
        // Schedule reminders for fetched events (silent, non-blocking)
        reminderService.scheduleRemindersForEvents(expanded).catch((err) => {
          console.warn('[Reminder] Failed to schedule batch reminders:', err);
        });
      } catch (err: any) {
        const msg = err?.message || 'Failed to load events';
        setError(msg);
        if (!silent) alert('Error', msg, 'error');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [dateRange, alert],
  );

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Re-fetch silently when screen regains focus (e.g., after create/update/delete)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchEvents(true);
    });
    return unsubscribe;
  }, [navigation, fetchEvents]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchEvents(true);
  }, [fetchEvents]);

  // ── Expand / collapse toggle ──────────────────────────
  const toggleCalendarExpand = useCallback(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        250,
        LayoutAnimation.Types.easeInEaseOut,
        LayoutAnimation.Properties.scaleY,
      ),
    );
    setIsCalendarExpanded((prev) => !prev);
  }, []);

  // ── Navigation ──────────────────────────────────────────
  const goToPrevious = useCallback(() => {
    const now = new Date();
    switch (viewMode) {
      case 'day':
        setViewDate((prev) => {
          const d = new Date(prev);
          d.setDate(d.getDate() - 1);
          return d;
        });
        setSelectedDate((prev) => {
          const d = new Date(prev || viewDate);
          d.setDate(d.getDate() - 1);
          return d;
        });
        break;
      case 'week':
        setViewDate((prev) => {
          const d = new Date(prev);
          d.setDate(d.getDate() - 7);
          return d;
        });
        setSelectedDate((prev) => {
          const d = new Date(prev || viewDate);
          d.setDate(d.getDate() - 7);
          return d;
        });
        break;
      case 'month':
      default: {
        setViewDate((prev) => {
          const d = new Date(prev);
          d.setDate(1);
          d.setMonth(d.getMonth() - 1);
          return d;
        });
        // For month nav: select today if landing on current month, else null
        setViewDate((current) => {
          if (current.getFullYear() === now.getFullYear() && current.getMonth() === now.getMonth()) {
            setSelectedDate(new Date());
          } else {
            setSelectedDate(null);
          }
          return current;
        });
        break;
      }
    }
  }, [viewMode, viewDate]);

  const goToNext = useCallback(() => {
    const now = new Date();
    switch (viewMode) {
      case 'day':
        setViewDate((prev) => {
          const d = new Date(prev);
          d.setDate(d.getDate() + 1);
          return d;
        });
        setSelectedDate((prev) => {
          const d = new Date(prev || viewDate);
          d.setDate(d.getDate() + 1);
          return d;
        });
        break;
      case 'week':
        setViewDate((prev) => {
          const d = new Date(prev);
          d.setDate(d.getDate() + 7);
          return d;
        });
        setSelectedDate((prev) => {
          const d = new Date(prev || viewDate);
          d.setDate(d.getDate() + 7);
          return d;
        });
        break;
      case 'month':
      default: {
        setViewDate((prev) => {
          const d = new Date(prev);
          d.setDate(1);
          d.setMonth(d.getMonth() + 1);
          return d;
        });
        // For month nav: select today if landing on current month, else null
        setViewDate((current) => {
          if (current.getFullYear() === now.getFullYear() && current.getMonth() === now.getMonth()) {
            setSelectedDate(new Date());
          } else {
            setSelectedDate(null);
          }
          return current;
        });
        break;
      }
    }
  }, [viewMode, viewDate]);

  const goToToday = useCallback(() => {
    const now = new Date();
    setViewDate(now);
    setSelectedDate(now);
  }, []);

  // ── Date selection from MonthGrid ─────────────────────
  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  // ── Event press handler ─────────────────────────────────
  const handleEventPress = useCallback(
    (event: CalendarEvent) => {
      navigation.navigate('EventDetail', { eventId: event.id, event });
    },
    [navigation],
  );

  // ── Derived data for month view ─────────────────────────
  const eventsForSelectedDay = useMemo(
    () =>
      selectedDate
        ? events.filter((e) => isSameDay(new Date(e.startDateTime), selectedDate))
        : [],
    [events, selectedDate],
  );

  // ── Time grid event/slot handlers ───────────────────────
  const handleSlotPress = useCallback(
    (date: Date) => {
      navigation.navigate('NewEvent', { date: date.toISOString() });
    },
    [navigation],
  );

  // ── Loading state ───────────────────────────────────────
  if (isLoading && events.length === 0) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header: nav + view toggle */}
      <CalendarHeader
        viewDate={viewDate}
        selectedDate={selectedDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrevious={goToPrevious}
        onNext={goToNext}
        onToday={goToToday}
      />

      {/* View content */}
      {viewMode === 'month' && (
        <View style={styles.monthContainer}>
          <MonthGrid
            currentYear={viewDate.getFullYear()}
            currentMonth={viewDate.getMonth()}
            selectedDate={selectedDate}
            events={events}
            onDateSelect={handleDateSelect}
            expanded={isCalendarExpanded}
            onToggleExpand={toggleCalendarExpand}
          />
          <View style={styles.eventListArea}>
            <DayEventList
              selectedDate={selectedDate}
              events={eventsForSelectedDay}
              isRefreshing={isRefreshing}
              onRefresh={handleRefresh}
              onEventPress={handleEventPress}
            />
          </View>
        </View>
      )}

      {(viewMode === 'day' || viewMode === 'week') && (
        <TimeGrid
          viewMode={viewMode}
          selectedDate={viewDate}
          events={events}
          onEventPress={handleEventPress}
          onSlotPress={handleSlotPress}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />
      )}

      {AlertComponent}

      {/* FAB */}
      <FloatingActionButton
        icon="add"
        onPress={() =>
          navigation.navigate('NewEvent', {
            date: (selectedDate || viewDate).toISOString(),
          })
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthContainer: {
    flex: 1,
  },
  eventListArea: {
    flex: 1,
  },
});

export default CalendarScreen;
