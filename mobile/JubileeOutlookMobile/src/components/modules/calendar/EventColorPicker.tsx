/**
 * EventColorPicker — Row of 6 color circles for event category selection.
 *
 * Matches web's CATEGORY_OPTIONS. Selected circle gets a gold border ring.
 * Each circle is 40px diameter with 8px spacing for touch-friendliness.
 */
import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import { CATEGORY_OPTIONS } from '../../../utils/calendarUtils';

interface EventColorPickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export const EventColorPicker: React.FC<EventColorPickerProps> = ({
  selected,
  onSelect,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {CATEGORY_OPTIONS.map((opt) => {
          const isSelected = opt.value === selected;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.circle,
                { backgroundColor: opt.color },
                isSelected && styles.circleSelected,
              ]}
              onPress={() => onSelect(opt.value)}
              activeOpacity={0.7}
            />
          );
        })}
      </View>
      <Text style={styles.label}>
        {CATEGORY_OPTIONS.find((o) => o.value === selected)?.label || 'Select color'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  circleSelected: {
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  label: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
  },
});
