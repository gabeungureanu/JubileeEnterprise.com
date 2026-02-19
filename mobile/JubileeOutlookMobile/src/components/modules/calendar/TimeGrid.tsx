/**
 * TimeGrid — Shared time-based grid used by Day and Week views.
 *
 * Renders 24-hour vertical scroll with hour labels on the left gutter,
 * event blocks positioned using the overlap detection algorithm,
 * current-time indicator on today's column, and an all-day row above.
 *
 * Day view: 1 column, full-width events.
 * Week view: 7 columns, narrow events with truncated display.
 */
import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableWithoutFeedback,
  RefreshControl,
  StyleSheet,
  Dimensions,
} from 'react-native';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import type { CalendarEvent, CalendarViewMode } from '../../../types/calendar';
import {
  HOURS,
  HOUR_HEIGHT_DAY,
  HOUR_HEIGHT_WEEK,
  isSameDay,
  getWeekStart,
  detectOverlaps,
} from '../../../utils/calendarUtils';
import { TimeGridEvent } from './TimeGridEvent';
import { AllDayRow } from './AllDayRow';

const GUTTER_WIDTH = 50;
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TimeGridProps {
  viewMode: 'day' | 'week';
  selectedDate: Date;
  events: CalendarEvent[];
  onEventPress: (event: CalendarEvent) => void;
  onSlotPress: (date: Date) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const TimeGrid: React.FC<TimeGridProps> = ({
  viewMode,
  selectedDate,
  events,
  onEventPress,
  onSlotPress,
  onRefresh,
  isRefreshing,
}) => {
  const scrollRef = useRef<ScrollView>(null);
  const isWeek = viewMode === 'week';
  const hourHeight = isWeek ? HOUR_HEIGHT_WEEK : HOUR_HEIGHT_DAY;
  const totalHeight = hourHeight * 24;
  const columnWidth = isWeek
    ? (SCREEN_WIDTH - GUTTER_WIDTH) / 7
    : SCREEN_WIDTH - GUTTER_WIDTH;

  // ── Column dates ────────────────────────────────────────
  const columns: Date[] = useMemo(() => {
    if (isWeek) {
      const ws = getWeekStart(selectedDate);
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(ws);
        d.setDate(d.getDate() + i);
        return d;
      });
    }
    return [new Date(selectedDate)];
  }, [selectedDate, isWeek]);

  // ── Separate all-day and timed events per column ────────
  const { allDayEvents, columnTimedEvents } = useMemo(() => {
    const allDay: CalendarEvent[] = [];
    const colTimed: CalendarEvent[][] = columns.map(() => []);

    for (const ev of events) {
      if (ev.isAllDay) {
        // Check if this all-day event falls on any visible column
        const evStart = new Date(ev.startDateTime);
        for (let c = 0; c < columns.length; c++) {
          if (isSameDay(evStart, columns[c])) {
            allDay.push(ev);
            break;
          }
        }
      } else {
        const evStart = new Date(ev.startDateTime);
        for (let c = 0; c < columns.length; c++) {
          if (isSameDay(evStart, columns[c])) {
            colTimed[c].push(ev);
          }
        }
      }
    }

    return { allDayEvents: allDay, columnTimedEvents: colTimed };
  }, [events, columns]);

  // ── Positioned events per column ────────────────────────
  const positionedByColumn = useMemo(
    () => columnTimedEvents.map((colEvents) => detectOverlaps(colEvents, hourHeight)),
    [columnTimedEvents, hourHeight],
  );

  // ── Auto-scroll to current hour ────────────────────────
  useEffect(() => {
    const now = new Date();
    const targetHour = Math.max(now.getHours() - 1, 0);
    const yOffset = targetHour * hourHeight;
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: yOffset, animated: false });
    }, 100);
  }, [viewMode, hourHeight]);

  // ── Current time indicator position ────────────────────
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeTop = (nowMinutes / 60) * hourHeight;

  // Find which column index is today (if any)
  const todayColumnIndex = columns.findIndex((d) => isSameDay(d, now));

  // ── Slot press handler ─────────────────────────────────
  const handleSlotPress = useCallback(
    (colIndex: number, yPosition: number) => {
      const minutes = Math.floor((yPosition / hourHeight) * 60);
      const hour = Math.floor(minutes / 60);
      const minute = Math.round((minutes % 60) / 30) * 30;
      const date = new Date(columns[colIndex]);
      date.setHours(hour, minute, 0, 0);
      onSlotPress(date);
    },
    [columns, hourHeight, onSlotPress],
  );

  return (
    <View style={styles.container}>
      {/* Week column headers */}
      {isWeek && (
        <View style={styles.columnHeaderRow}>
          <View style={styles.gutterHeader} />
          {columns.map((date, i) => {
            const isToday = isSameDay(date, now);
            return (
              <View key={i} style={[styles.columnHeader, { width: columnWidth }]}>
                <Text style={[styles.columnDayName, isToday && styles.columnDayNameToday]}>
                  {WEEKDAYS_SHORT[date.getDay()]}
                </Text>
                <Text style={[styles.columnDate, isToday && styles.columnDateToday]}>
                  {date.getDate()}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* All-day events row */}
      <AllDayRow events={allDayEvents} onEventPress={onEventPress} />

      {/* Scrollable time grid */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={{ height: totalHeight }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Hour labels + gridlines */}
        {HOURS.map(({ hour24, label }) => (
          <View
            key={hour24}
            style={[styles.hourRow, { top: hour24 * hourHeight, height: hourHeight }]}
          >
            <View style={styles.gutterLabel}>
              <Text style={styles.hourText}>{label}</Text>
            </View>
            <View style={styles.gridLine} />
          </View>
        ))}

        {/* Tap zones per column */}
        {columns.map((_, colIndex) => (
          <TouchableWithoutFeedback
            key={`tap-${colIndex}`}
            onPress={(e) => handleSlotPress(colIndex, e.nativeEvent.locationY)}
          >
            <View
              style={[
                styles.tapZone,
                {
                  left: GUTTER_WIDTH + colIndex * columnWidth,
                  width: columnWidth,
                  height: totalHeight,
                },
              ]}
            />
          </TouchableWithoutFeedback>
        ))}

        {/* Event blocks per column */}
        {positionedByColumn.map((positioned, colIndex) =>
          positioned.map((p) => (
            <TimeGridEvent
              key={`${colIndex}-${p.event.id}`}
              positioned={{
                ...p,
                // Shift column/totalColumns to be relative to this visual column
                column: p.column,
                totalColumns: p.totalColumns,
              }}
              columnWidth={columnWidth}
              gutterWidth={GUTTER_WIDTH + colIndex * columnWidth}
              compact={isWeek}
              onPress={onEventPress}
            />
          )),
        )}

        {/* Current time indicator */}
        {todayColumnIndex >= 0 && (
          <View
            style={[
              styles.currentTimeLine,
              {
                top: currentTimeTop,
                left: GUTTER_WIDTH + todayColumnIndex * columnWidth,
                width: columnWidth,
              },
            ]}
          >
            <View style={styles.currentTimeDot} />
            <View style={styles.currentTimeBar} />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Column headers (week view)
  columnHeaderRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingVertical: Spacing.xs,
  },
  gutterHeader: {
    width: GUTTER_WIDTH,
  },
  columnHeader: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  columnDayName: {
    ...Typography.caption,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    fontSize: 10,
  },
  columnDayNameToday: {
    color: Colors.primary,
  },
  columnDate: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
  columnDateToday: {
    color: Colors.primary,
    fontWeight: '700',
  },

  // Scrollable grid
  scrollView: {
    flex: 1,
  },
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  gutterLabel: {
    width: GUTTER_WIDTH,
    paddingRight: Spacing.xs,
    alignItems: 'flex-end',
  },
  hourText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontSize: 10,
    marginTop: -6,
  },
  gridLine: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },

  // Tap zones
  tapZone: {
    position: 'absolute',
    top: 0,
    zIndex: 0,
  },

  // Current time indicator
  currentTimeLine: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  currentTimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    marginLeft: -4,
  },
  currentTimeBar: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.error,
  },
});
