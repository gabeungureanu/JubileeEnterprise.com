/**
 * DayOfWeekPicker — 7 circular buttons for selecting days in weekly recurrence.
 *
 * S M T W T F S — gold when selected. 40px each for touch-friendliness.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import { DAYS_OF_WEEK } from '../../../utils/calendarUtils';

interface DayOfWeekPickerProps {
  selectedDays: string[];
  onToggle: (dayKey: string) => void;
}

export const DayOfWeekPicker: React.FC<DayOfWeekPickerProps> = ({
  selectedDays,
  onToggle,
}) => {
  return (
    <View style={styles.container}>
      {DAYS_OF_WEEK.map((day) => {
        const isSelected = selectedDays.includes(day.key);
        return (
          <TouchableOpacity
            key={day.key}
            style={[styles.circle, isSelected && styles.circleSelected]}
            onPress={() => onToggle(day.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, isSelected && styles.labelSelected]}>
              {day.label}
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
    justifyContent: 'space-between',
    marginVertical: Spacing.sm,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
  },
  circleSelected: {
    backgroundColor: Colors.primary,
  },
  label: {
    ...Typography.button,
    color: Colors.textSecondary,
    fontSize: 13,
  },
  labelSelected: {
    color: Colors.textInverse,
  },
});
