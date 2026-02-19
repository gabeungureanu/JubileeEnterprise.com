/**
 * AllDayRow — Horizontal scrollable row of all-day event chips.
 *
 * Displayed above the TimeGrid when there are all-day events.
 * Each chip shows event color + truncated title.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import type { CalendarEvent } from '../../../types/calendar';
import { getEventColor } from '../../../utils/calendarUtils';

interface AllDayRowProps {
  events: CalendarEvent[];
  onEventPress: (event: CalendarEvent) => void;
}

export const AllDayRow: React.FC<AllDayRowProps> = ({ events, onEventPress }) => {
  if (events.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ALL DAY</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {events.map((event) => {
          const color = getEventColor(event.eventColor || event.category);
          return (
            <TouchableOpacity
              key={event.id}
              style={[styles.chip, { backgroundColor: color + '30', borderLeftColor: color }]}
              activeOpacity={0.7}
              onPress={() => onEventPress(event)}
            >
              <Text style={styles.chipText} numberOfLines={1}>
                {event.isPrivate ? 'Private' : event.title}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    paddingVertical: Spacing.xs,
    minHeight: 36,
  },
  label: {
    ...Typography.caption,
    color: Colors.textTertiary,
    width: 50,
    textAlign: 'center',
    fontSize: 9,
  },
  scrollContent: {
    paddingRight: Spacing.md,
    gap: Spacing.xs,
  },
  chip: {
    borderLeftWidth: 3,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    maxWidth: 140,
  },
  chipText: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
});
