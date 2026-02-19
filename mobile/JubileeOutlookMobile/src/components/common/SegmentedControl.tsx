/**
 * SegmentedControl — Horizontal toggle for selecting one of N options.
 *
 * Used for calendar view mode switching (Day / Week / Month) and
 * any other multi-option toggle throughout the app.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
}

function SegmentedControlInner<T extends string>({
  options,
  selected,
  onSelect,
}: SegmentedControlProps<T>) {
  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.segment, isActive && styles.segmentActive]}
            onPress={() => onSelect(opt.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export const SegmentedControl = React.memo(
  SegmentedControlInner,
) as typeof SegmentedControlInner;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.xxs,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.sm,
    minHeight: 44,
  },
  segmentActive: {
    backgroundColor: Colors.primary,
  },
  label: {
    ...Typography.button,
    color: Colors.textSecondary,
  },
  labelActive: {
    color: Colors.textInverse,
  },
});
