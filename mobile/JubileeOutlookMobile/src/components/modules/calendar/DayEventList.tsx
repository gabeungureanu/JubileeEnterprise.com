/**
 * DayEventList — Selected-day header + scrollable FlatList of events.
 *
 * Extracted from CalendarScreen for use in the month-view layout.
 * Shows events for a single selected day with colored left bars.
 */
import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import { EmptyState } from '../../common';
import type { CalendarEvent } from '../../../types/calendar';
import { getEventColor } from '../../../utils/calendarUtils';

function formatTime(iso: string): string {
  const d = new Date(iso);
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  const mm = m.toString().padStart(2, '0');
  return `${h12}:${mm} ${ampm}`;
}

interface DayEventListProps {
  selectedDate: Date | null;
  events: CalendarEvent[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onEventPress: (event: CalendarEvent) => void;
}

export const DayEventList: React.FC<DayEventListProps> = ({
  selectedDate,
  events,
  isRefreshing,
  onRefresh,
  onEventPress,
}) => {
  const renderEventItem = ({ item }: { item: CalendarEvent }) => (
    <TouchableOpacity
      style={styles.eventRow}
      activeOpacity={0.7}
      onPress={() => onEventPress(item)}
    >
      <View
        style={[
          styles.eventColorBar,
          { backgroundColor: getEventColor(item.eventColor || item.category) },
        ]}
      />
      <View style={styles.eventContent}>
        <Text style={styles.eventTime}>
          {item.isAllDay
            ? 'All Day'
            : `${formatTime(item.startDateTime)} - ${formatTime(item.endDateTime)}`}
        </Text>
        <Text style={styles.eventSubject} numberOfLines={1}>
          {item.isPrivate ? 'Private' : item.title}
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

  return (
    <View style={styles.wrapper}>
      {/* Selected day label */}
      <View style={styles.selectedDayHeader}>
        <Text style={styles.selectedDayText}>
          {selectedDate
            ? selectedDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })
            : 'Tap a date to view events'}
        </Text>
      </View>

      {/* Event list */}
      <FlatList
        style={styles.list}
        data={selectedDate ? events : []}
        keyExtractor={(item) => item.id}
        renderItem={renderEventItem}
        contentContainerStyle={
          !selectedDate || events.length === 0 ? styles.emptyList : styles.eventList
        }
        ListEmptyComponent={
          <EmptyState
            icon="event"
            title={selectedDate ? 'No events' : 'No date selected'}
            subtitle={selectedDate ? 'No events scheduled for this day' : 'Select a date from the calendar above'}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
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
