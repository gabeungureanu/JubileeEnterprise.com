/**
 * CalendarHeader — Date navigation + Today button + view mode toggle.
 *
 * Adapts title format per view mode:
 *   Month → "February 2026"
 *   Week  → "Feb 16 – 22, 2026"
 *   Day   → "Wed, Feb 19, 2026"
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius, HitSlop } from '../../../constants/spacing';
import { SegmentedControl } from '../../common/SegmentedControl';
import type { CalendarViewMode } from '../../../types/calendar';
import { getWeekStart, getWeekEnd, isSameDay } from '../../../utils/calendarUtils';

const VIEW_OPTIONS: { value: CalendarViewMode; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarHeaderProps {
  viewDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  viewDate,
  viewMode,
  onViewModeChange,
  onPrevious,
  onNext,
  onToday,
}) => {
  const today = new Date();
  const isCurrentPeriod = viewMode === 'month'
    ? viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() === today.getMonth()
    : isSameDay(viewDate, today);

  const title = useMemo(() => {
    switch (viewMode) {
      case 'day':
        return `${DAY_NAMES[viewDate.getDay()]}, ${MONTH_SHORT[viewDate.getMonth()]} ${viewDate.getDate()}, ${viewDate.getFullYear()}`;
      case 'week': {
        const ws = getWeekStart(viewDate);
        const we = getWeekEnd(viewDate);
        if (ws.getMonth() === we.getMonth()) {
          return `${MONTH_SHORT[ws.getMonth()]} ${ws.getDate()} – ${we.getDate()}, ${ws.getFullYear()}`;
        }
        return `${MONTH_SHORT[ws.getMonth()]} ${ws.getDate()} – ${MONTH_SHORT[we.getMonth()]} ${we.getDate()}, ${we.getFullYear()}`;
      }
      case 'month':
      default:
        return `${MONTH_NAMES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;
    }
  }, [viewDate, viewMode]);

  return (
    <View style={styles.container}>
      {/* Navigation row */}
      <View style={styles.navRow}>
        <TouchableOpacity onPress={onPrevious} hitSlop={HitSlop} style={styles.navButton}>
          <Icon name="chevron-left" size={28} color={Colors.primary} />
        </TouchableOpacity>

        <View style={styles.titleArea}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        </View>

        <TouchableOpacity onPress={onNext} hitSlop={HitSlop} style={styles.navButton}>
          <Icon name="chevron-right" size={28} color={Colors.primary} />
        </TouchableOpacity>

        {!isCurrentPeriod && (
          <TouchableOpacity
            onPress={onToday}
            style={styles.todayButton}
            activeOpacity={0.7}
          >
            <Text style={styles.todayText}>Today</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* View mode toggle */}
      <View style={styles.segmentRow}>
        <SegmentedControl
          options={VIEW_OPTIONS}
          selected={viewMode}
          onSelect={onViewModeChange}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  navButton: {
    padding: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleArea: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
  },
  todayButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    minHeight: 32,
    justifyContent: 'center',
  },
  todayText: {
    ...Typography.buttonSmall,
    color: Colors.textInverse,
  },
  segmentRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
});
