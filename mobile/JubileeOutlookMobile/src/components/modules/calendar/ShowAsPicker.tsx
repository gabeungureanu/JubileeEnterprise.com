/**
 * ShowAsPicker — Horizontal row of 5 status pills for event visibility.
 *
 * Matches web's SHOW_AS_OPTIONS. Selected pill gets gold underline.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import { SHOW_AS_OPTIONS } from '../../../utils/calendarUtils';
import type { ShowAsStatus } from '../../../types/calendar';

interface ShowAsPickerProps {
  selected: string;
  onSelect: (value: ShowAsStatus) => void;
}

export const ShowAsPicker: React.FC<ShowAsPickerProps> = ({ selected, onSelect }) => {
  return (
    <View style={styles.container}>
      {SHOW_AS_OPTIONS.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <View style={[styles.dot, { backgroundColor: opt.color }]} />
            <Text
              style={[styles.pillText, isActive && styles.pillTextActive]}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginVertical: Spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    minHeight: 36,
  },
  pillActive: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.xs,
  },
  pillText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
