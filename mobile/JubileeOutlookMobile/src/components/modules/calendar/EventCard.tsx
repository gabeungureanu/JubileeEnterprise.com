import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import type { CalendarEvent } from '../../../types';

interface EventCardProps {
  event: CalendarEvent;
  onPress: () => void;
}

function formatEventTime(startDateTime: string, endDateTime: string, isAllDay: boolean): string {
  if (isAllDay) return 'All day';
  const start = new Date(startDateTime);
  const end = new Date(endDateTime);
  const fmt = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${fmt(start)} - ${fmt(end)}`;
}

export function EventCard({ event, onPress }: EventCardProps) {
  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.colorBar, { backgroundColor: event.eventColor || Colors.accent }]} />
      <View style={styles.content}>
        <Text style={styles.time}>
          {formatEventTime(event.startDateTime, event.endDateTime, event.isAllDay)}
        </Text>
        <Text style={styles.subject} numberOfLines={1}>{event.title}</Text>
        {event.location && (
          <View style={styles.locationRow}>
            <Icon name="place" size={14} color={Colors.textTertiary} />
            <Text style={styles.location} numberOfLines={1}>{event.location}</Text>
          </View>
        )}
      </View>
      <Icon name="chevron-right" size={20} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.xs,
    overflow: 'hidden',
  },
  colorBar: {
    width: 4,
    alignSelf: 'stretch',
  },
  content: {
    flex: 1,
    padding: Spacing.md,
    gap: 2,
  },
  time: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  subject: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  location: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
