/**
 * TimeGridEvent — Single event block positioned within the TimeGrid.
 *
 * Shows event color (background + left bar), truncated title, and
 * time range. In narrow columns (week view) only shows color + title.
 */
import React from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { View } from 'react-native';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import type { CalendarEvent } from '../../../types/calendar';
import type { PositionedEvent } from '../../../utils/calendarUtils';
import { formatTime12h, getEventColor } from '../../../utils/calendarUtils';

interface TimeGridEventProps {
  positioned: PositionedEvent;
  columnWidth: number;
  gutterWidth: number;
  compact?: boolean;
  onPress: (event: CalendarEvent) => void;
}

export const TimeGridEvent: React.FC<TimeGridEventProps> = ({
  positioned,
  columnWidth,
  gutterWidth,
  compact = false,
  onPress,
}) => {
  const { event, top, height, column, totalColumns } = positioned;
  const color = getEventColor(event.eventColor || event.category);

  const eventWidth = columnWidth / totalColumns;
  const leftOffset = gutterWidth + column * eventWidth;

  const start = new Date(event.startDateTime);
  const title = event.isPrivate ? 'Private' : event.title;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          top,
          height: Math.max(height, 15),
          left: leftOffset,
          width: eventWidth - 2,
          backgroundColor: color + '30', // 30 = ~19% opacity
          borderLeftColor: color,
        },
      ]}
      activeOpacity={0.7}
      onPress={() => onPress(event)}
    >
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      {!compact && height > 25 && (
        <Text style={styles.time} numberOfLines={1}>
          {formatTime12h(start)}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    borderLeftWidth: 3,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.xxs,
    paddingVertical: 1,
    overflow: 'hidden',
    zIndex: 1,
  },
  title: {
    ...Typography.caption,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  time: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontSize: 10,
  },
});
