/**
 * RecurrenceEditor — Full recurrence configuration form.
 *
 * Contains: recurrence type picker, interval input, day-of-week picker
 * (for weekly), end condition, and end date / occurrence count inputs.
 */
import React, { useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import { RECURRENCE_TYPES, RECURRENCE_END_OPTIONS } from '../../../utils/calendarUtils';
import { DayOfWeekPicker } from './DayOfWeekPicker';
import { DatePickerField } from './DatePickerField';

interface RecurrenceEditorProps {
  recurrenceType: string;
  recurrenceInterval: number;
  recurrenceDaysOfWeek: string[];
  recurrenceEndCondition: string; // 'Never' | 'On date' | 'After occurrences'
  recurrenceEndDate: Date | null;
  recurrenceOccurrences: number | null;
  onTypeChange: (type: string) => void;
  onIntervalChange: (interval: number) => void;
  onDaysOfWeekToggle: (day: string) => void;
  onEndConditionChange: (condition: string) => void;
  onEndDateChange: (date: Date) => void;
  onOccurrencesChange: (count: number) => void;
}

const typeSuffixMap: Record<string, { singular: string; plural: string }> = {
  Daily: { singular: 'day', plural: 'days' },
  Weekly: { singular: 'week', plural: 'weeks' },
  Monthly: { singular: 'month', plural: 'months' },
  Yearly: { singular: 'year', plural: 'years' },
};

export const RecurrenceEditor: React.FC<RecurrenceEditorProps> = ({
  recurrenceType,
  recurrenceInterval,
  recurrenceDaysOfWeek,
  recurrenceEndCondition,
  recurrenceEndDate,
  recurrenceOccurrences,
  onTypeChange,
  onIntervalChange,
  onDaysOfWeekToggle,
  onEndConditionChange,
  onEndDateChange,
  onOccurrencesChange,
}) => {
  const suffix = typeSuffixMap[recurrenceType] || typeSuffixMap.Daily;

  const handleIntervalText = useCallback(
    (text: string) => {
      const num = parseInt(text, 10);
      if (!isNaN(num) && num > 0) onIntervalChange(num);
    },
    [onIntervalChange],
  );

  const handleOccurrencesText = useCallback(
    (text: string) => {
      const num = parseInt(text, 10);
      if (!isNaN(num) && num > 0) onOccurrencesChange(num);
    },
    [onOccurrencesChange],
  );

  return (
    <View style={styles.container}>
      {/* Recurrence type */}
      <Text style={styles.label}>Repeat</Text>
      <View style={styles.typeRow}>
        {RECURRENCE_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typePill, type === recurrenceType && styles.typePillActive]}
            onPress={() => onTypeChange(type)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.typePillText,
                type === recurrenceType && styles.typePillTextActive,
              ]}
            >
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Interval */}
      <View style={styles.intervalRow}>
        <Text style={styles.intervalLabel}>Every</Text>
        <TextInput
          style={styles.intervalInput}
          value={String(recurrenceInterval)}
          onChangeText={handleIntervalText}
          keyboardType="number-pad"
          maxLength={3}
        />
        <Text style={styles.intervalLabel}>
          {recurrenceInterval === 1 ? suffix.singular : suffix.plural}
        </Text>
      </View>

      {/* Days of week (weekly only) */}
      {recurrenceType === 'Weekly' && (
        <>
          <Text style={styles.label}>On these days</Text>
          <DayOfWeekPicker
            selectedDays={recurrenceDaysOfWeek}
            onToggle={onDaysOfWeekToggle}
          />
        </>
      )}

      {/* End condition */}
      <Text style={[styles.label, { marginTop: Spacing.md }]}>Ends</Text>
      <View style={styles.typeRow}>
        {RECURRENCE_END_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt}
            style={[
              styles.typePill,
              opt === recurrenceEndCondition && styles.typePillActive,
            ]}
            onPress={() => onEndConditionChange(opt)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.typePillText,
                opt === recurrenceEndCondition && styles.typePillTextActive,
              ]}
            >
              {opt}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* End date (when "On date" selected) */}
      {recurrenceEndCondition === 'On date' && recurrenceEndDate && (
        <View style={styles.endDateRow}>
          <DatePickerField
            date={recurrenceEndDate}
            onDateChange={onEndDateChange}
            label="End date"
          />
        </View>
      )}

      {/* Occurrences count (when "After occurrences" selected) */}
      {recurrenceEndCondition === 'After occurrences' && (
        <View style={styles.intervalRow}>
          <Text style={styles.intervalLabel}>After</Text>
          <TextInput
            style={styles.intervalInput}
            value={String(recurrenceOccurrences || 10)}
            onChangeText={handleOccurrencesText}
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={styles.intervalLabel}>occurrences</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  typePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    minHeight: 36,
    justifyContent: 'center',
  },
  typePillActive: {
    backgroundColor: Colors.primary,
  },
  typePillText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
  },
  typePillTextActive: {
    color: Colors.textInverse,
    fontWeight: '600',
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  intervalLabel: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  intervalInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minWidth: 60,
    textAlign: 'center',
    color: Colors.textPrimary,
    ...Typography.body,
  },
  endDateRow: {
    marginTop: Spacing.sm,
  },
});
