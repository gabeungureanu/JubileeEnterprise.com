/**
 * MonthGrid — Collapsible month/week calendar grid.
 *
 * Compact mode (default): shows only the week containing the selected date.
 * Expanded mode: shows the full month grid with all weeks.
 *
 * Features: weekday labels, selected-day circle (visually balanced),
 * today highlight, colored event dots, drag handle toggle.
 */
import React, { useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, PanResponder, StyleSheet } from 'react-native';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import type { CalendarEvent } from '../../../types/calendar';
import { isSameDay, getDaysInMonth, getFirstDayOfWeek, getEventColor } from '../../../utils/calendarUtils';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface MonthGridProps {
  currentYear: number;
  currentMonth: number;
  selectedDate: Date | null;
  events: CalendarEvent[];
  onDateSelect: (date: Date) => void;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export const MonthGrid: React.FC<MonthGridProps> = ({
  currentYear,
  currentMonth,
  selectedDate,
  events,
  onDateSelect,
  expanded = false,
  onToggleExpand,
}) => {
  const SWIPE_THRESHOLD = 30;

  // Refs to avoid stale closures inside PanResponder
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const toggleRef = useRef(onToggleExpand);
  toggleRef.current = onToggleExpand;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        // Only claim the gesture if vertical movement exceeds horizontal
        // (prevents interfering with horizontal swipes or taps)
        return (
          Math.abs(gestureState.dy) > 10 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx)
        );
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (!toggleRef.current) return;
        if (gestureState.dy > SWIPE_THRESHOLD && !expandedRef.current) {
          // Swipe down while collapsed → expand
          toggleRef.current();
        } else if (gestureState.dy < -SWIPE_THRESHOLD && expandedRef.current) {
          // Swipe up while expanded → collapse
          toggleRef.current();
        }
      },
    }),
  ).current;

  const today = new Date();

  // Build map: dayNumber → array of event colors for that day
  const dayEventColors = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const e of events) {
      const start = new Date(e.startDateTime);
      if (
        start.getFullYear() === currentYear &&
        start.getMonth() === currentMonth
      ) {
        const day = start.getDate();
        const color = getEventColor(e.eventColor || e.category);
        const existing = map.get(day) || [];
        if (existing.length < 3 && !existing.includes(color)) {
          existing.push(color);
          map.set(day, existing);
        }
      }
    }
    return map;
  }, [events, currentYear, currentMonth]);

  // Build all calendar cells (full month)
  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfWeek(currentYear, currentMonth);

  const allCells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) allCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) allCells.push(d);
  while (allCells.length % 7 !== 0) allCells.push(null);

  // Split into week rows
  const weekRows: (number | null)[][] = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weekRows.push(allCells.slice(i, i + 7));
  }

  // Determine which week row to show in compact mode
  // If a date is selected and belongs to this month, show its week.
  // Otherwise show the week containing today (if this month) or the first week.
  const selectedDay = selectedDate &&
    selectedDate.getFullYear() === currentYear &&
    selectedDate.getMonth() === currentMonth
    ? selectedDate.getDate()
    : null;

  const compactDay = selectedDay
    ?? (today.getFullYear() === currentYear && today.getMonth() === currentMonth
      ? today.getDate()
      : 1);

  const compactWeekIndex = weekRows.findIndex((row) =>
    row.includes(compactDay),
  );
  const activeWeekIndex = compactWeekIndex >= 0 ? compactWeekIndex : 0;

  // Rows to render: compact = just the selected week, expanded = all weeks
  const visibleRows = expanded ? weekRows : [weekRows[activeWeekIndex]];

  const renderDayCell = (day: number | null, index: number) => {
    if (day === null) {
      return <View key={`empty-${index}`} style={styles.dayCell} />;
    }

    const cellDate = new Date(currentYear, currentMonth, day);
    const isToday = isSameDay(cellDate, today);
    const isSelected = selectedDate !== null && isSameDay(cellDate, selectedDate);
    const dotColors = dayEventColors.get(day);

    return (
      <TouchableOpacity
        key={`day-${day}`}
        style={styles.dayCell}
        onPress={() => onDateSelect(cellDate)}
        activeOpacity={0.7}
      >
        {/* Inner circle — equal padding all sides */}
        <View
          style={[
            styles.innerCircle,
            isSelected && styles.innerCircleSelected,
            isToday && !isSelected && styles.innerCircleToday,
          ]}
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
        </View>

        {/* Event dots — in normal flow below the circle */}
        <View style={styles.dotContainer}>
          {dotColors && dotColors.length > 0 ? (
            dotColors.map((color, i) => (
              <View
                key={`dot-${day}-${i}`}
                style={[
                  styles.eventDot,
                  { backgroundColor: isSelected ? Colors.textInverse : color },
                ]}
              />
            ))
          ) : (
            <View style={styles.dotPlaceholder} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* Weekday labels */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((wd) => (
          <View key={wd} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{wd}</Text>
          </View>
        ))}
      </View>

      {/* Calendar rows */}
      <View style={styles.calendarGrid}>
        {visibleRows.map((row, rowIdx) => (
          <View key={`row-${rowIdx}`} style={styles.weekRow}>
            {row.map((day, cellIdx) => renderDayCell(day, rowIdx * 7 + cellIdx))}
          </View>
        ))}
      </View>

      {/* Drag handle — tap to toggle expand/collapse */}
      {onToggleExpand && (
        <TouchableOpacity
          onPress={onToggleExpand}
          style={styles.handleTouchArea}
          activeOpacity={0.7}
        >
          <View style={styles.dragHandle} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const DAY_CELL_SIZE = 36;

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  weekdayRow: {
    flexDirection: 'row',
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
  calendarGrid: {
    paddingBottom: Spacing.xs,
  },
  weekRow: {
    flexDirection: 'row',
  },

  // Day cell — full tap target area
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xxs,
  },

  // Inner circle — equal padding, visually balanced
  innerCircle: {
    width: DAY_CELL_SIZE,
    height: DAY_CELL_SIZE,
    borderRadius: DAY_CELL_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerCircleSelected: {
    backgroundColor: Colors.primary,
  },
  innerCircleToday: {
    borderWidth: 1.5,
    borderColor: Colors.primary,
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

  // Dots — in normal flow below the circle
  dotContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 7,
    marginTop: 1,
    gap: 2,
  },
  eventDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotPlaceholder: {
    height: 5,
  },

  // Drag handle
  handleTouchArea: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    minHeight: 28,
    justifyContent: 'center',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    opacity: 0.5,
  },
});
