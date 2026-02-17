/**
 * CalendarScreen — Month-view calendar with day event list.
 *
 * Displays a custom month grid at the top with navigation arrows,
 * today highlight, selected-day highlight, and dot indicators for
 * days that have events. Below the grid the events for the selected
 * day are rendered in a scrollable FlatList with colored left bars.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner, EmptyState, FloatingActionButton } from '../../components/common';
import { calendarService } from '../../services/calendar/calendarService';
import type { CalendarEvent } from '../../types/calendar';
import type { CalendarStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<CalendarStackParamList, 'CalendarMain'>;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mm = m.toString().padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const CalendarScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();

  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────

  const fetchEvents = useCallback(
    async (year: number, month: number, silent = false) => {
      try {
        if (!silent) setIsLoading(true);
        setError(null);
        const data = await calendarService.getEventsForMonth(year, month + 1);
        setEvents(data);
      } catch (err: any) {
        const msg = err?.message || 'Failed to load events';
        setError(msg);
        if (!silent) Alert.alert('Error', msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    fetchEvents(currentYear, currentMonth);
  }, [currentYear, currentMonth, fetchEvents]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchEvents(currentYear, currentMonth, true);
  }, [currentYear, currentMonth, fetchEvents]);

  // ── Month navigation ─────────────────────────────────────

  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev === 0) {
        setCurrentYear((y) => y - 1);
        return 11;
      }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => {
      if (prev === 11) {
        setCurrentYear((y) => y + 1);
        return 0;
      }
      return prev + 1;
    });
  }, []);

  // ── Derived data ──────────────────────────────────────────

  const eventsForSelectedDay = events.filter((e) => {
    const start = new Date(e.startTime);
    return isSameDay(start, selectedDate);
  });

  const daysWithEvents = new Set(
    events.map((e) => new Date(e.startTime).getDate()),
  );

  // ── Calendar grid ─────────────────────────────────────────

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  // ── Render helpers ────────────────────────────────────────

  const renderDayCell = (day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const cellDate = new Date(currentYear, currentMonth, day);
    const isToday = isSameDay(cellDate, today);
    const isSelected = isSameDay(cellDate, selectedDate);
    const hasEvents = daysWithEvents.has(day);

    return (
      <TouchableOpacity
        key={`day-${day}`}
        style={[
          styles.dayCell,
          isSelected && styles.dayCellSelected,
          isToday && !isSelected && styles.dayCellToday,
        ]}
        onPress={() => setSelectedDate(cellDate)}
        activeOpacity={0.7}
      >
        <Text
          style={[
            styles.dayText,
            isSelected && styles.dayTextSelected,
            isToday && !isSelected && styles.dayTextToday,
          ]}
        >
          {day}
        </Text>
        {hasEvents && (
          <View
            style={[
              styles.eventDot,
              isSelected && styles.eventDotSelected,
            ]}
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderEventItem = ({ item }: { item: CalendarEvent }) => (
    <TouchableOpacity
      style={styles.eventRow}
      activeOpacity={0.7}
      onPress={() =>
        navigation.navigate('EventDetail', { eventId: item.id, event: item })
      }
    >
      <View style={[styles.eventColorBar, { backgroundColor: item.eventColor || Colors.accent }]} />
      <View style={styles.eventContent}>
        <Text style={styles.eventTime}>
          {item.isAllDay ? 'All Day' : `${formatTime(item.startTime)} - ${formatTime(item.endTime)}`}
        </Text>
        <Text style={styles.eventSubject} numberOfLines={1}>
          {item.subject}
        </Text>
        {!!item.location && (
          <View style={styles.eventLocationRow}>
            <Icon name="place" size={14} color={Colors.textTertiary} />
            <Text style={styles.eventLocation} numberOfLines={1}>
              {item.location}
            </Text>
          </View>
        )}
      </View>
      <Icon name="chevron-right" size={22} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  // ── Main render ───────────────────────────────────────────

  if (isLoading && events.length === 0) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Month header */}
      <View style={styles.monthHeader}>
        <TouchableOpacity onPress={goToPreviousMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="chevron-left" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[currentMonth]} {currentYear}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="chevron-right" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Weekday labels */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((wd) => (
          <View key={wd} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{wd}</Text>
          </View>
        ))}
      </View>

      {/* Calendar grid */}
      <View style={styles.calendarGrid}>
        {calendarCells.map((day, idx) => renderDayCell(day, idx))}
      </View>

      {/* Selected day label */}
      <View style={styles.selectedDayHeader}>
        <Text style={styles.selectedDayText}>
          {selectedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      {/* Event list */}
      {error && !isLoading ? (
        <View style={styles.centered}>
          <EmptyState
            icon="error-outline"
            title="Failed to load events"
            subtitle={error}
          />
        </View>
      ) : (
        <FlatList
          data={eventsForSelectedDay}
          keyExtractor={(item) => item.id}
          renderItem={renderEventItem}
          contentContainerStyle={
            eventsForSelectedDay.length === 0 ? styles.emptyList : styles.eventList
          }
          ListEmptyComponent={
            <EmptyState
              icon="event"
              title="No events"
              subtitle="No events scheduled for this day"
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
      )}

      {/* FAB */}
      <FloatingActionButton
        icon="add"
        onPress={() =>
          navigation.navigate('NewEvent', {
            date: selectedDate.toISOString(),
          })
        }
      />
    </View>
  );
};

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

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

  // Month header
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
  },
  monthTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },

  // Weekday row
  weekdayRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekdayText: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
  },

  // Calendar grid
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.surface,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  dayCell: {
    width: '14.285%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  dayText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  dayTextSelected: {
    color: Colors.textInverse,
    fontWeight: '700',
  },
  dayTextToday: {
    color: Colors.primary,
    fontWeight: '600',
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.accent,
    marginTop: 2,
    position: 'absolute',
    bottom: 6,
  },
  eventDotSelected: {
    backgroundColor: Colors.textInverse,
  },

  // Selected day label
  selectedDayHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  selectedDayText: {
    ...Typography.label,
    color: Colors.textSecondary,
  },

  // Event list
  eventList: {
    paddingBottom: 80,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingRight: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  eventColorBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    marginLeft: Spacing.lg,
    marginRight: Spacing.md,
  },
  eventContent: {
    flex: 1,
  },
  eventTime: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  eventSubject: {
    ...Typography.bodyLarge,
    color: Colors.textPrimary,
  },
  eventLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  eventLocation: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginLeft: 2,
  },
});

export default CalendarScreen;
