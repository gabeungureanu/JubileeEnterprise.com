/**
 * DatePickerField — Tappable field showing formatted date.
 *
 * Opens a mini month grid in a bottom sheet for date selection.
 * Reuses the MonthGrid component for consistency.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import { BottomSheet } from '../../common';
import { MonthGrid } from './MonthGrid';

interface DatePickerFieldProps {
  date: Date;
  onDateChange: (date: Date) => void;
  label?: string;
}

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  date,
  onDateChange,
  label,
}) => {
  const [visible, setVisible] = useState(false);
  const [browseYear, setBrowseYear] = useState(date.getFullYear());
  const [browseMonth, setBrowseMonth] = useState(date.getMonth());

  const handleOpen = useCallback(() => {
    setBrowseYear(date.getFullYear());
    setBrowseMonth(date.getMonth());
    setVisible(true);
  }, [date]);

  const handleSelect = useCallback(
    (selected: Date) => {
      // Preserve the time from the original date
      const newDate = new Date(selected);
      newDate.setHours(date.getHours(), date.getMinutes(), date.getSeconds());
      onDateChange(newDate);
      setVisible(false);
    },
    [date, onDateChange],
  );

  const handlePrevMonth = useCallback(() => {
    if (browseMonth === 0) {
      setBrowseYear((y) => y - 1);
      setBrowseMonth(11);
    } else {
      setBrowseMonth((m) => m - 1);
    }
  }, [browseMonth]);

  const handleNextMonth = useCallback(() => {
    if (browseMonth === 11) {
      setBrowseYear((y) => y + 1);
      setBrowseMonth(0);
    } else {
      setBrowseMonth((m) => m + 1);
    }
  }, [browseMonth]);

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const formatted = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <>
      <TouchableOpacity style={styles.field} onPress={handleOpen} activeOpacity={0.7}>
        <Icon name="calendar-today" size={18} color={Colors.textSecondary} />
        <View style={styles.textArea}>
          {label && <Text style={styles.label}>{label}</Text>}
          <Text style={styles.value}>{formatted}</Text>
        </View>
        <Icon name="expand-more" size={20} color={Colors.textTertiary} />
      </TouchableOpacity>

      <BottomSheet
        visible={visible}
        onClose={() => setVisible(false)}
        title="Select Date"
        maxHeight="70%"
      >
        {/* Month navigation inside sheet */}
        <View style={styles.sheetNav}>
          <TouchableOpacity onPress={handlePrevMonth} style={styles.sheetNavBtn}>
            <Icon name="chevron-left" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.sheetNavTitle}>
            {MONTH_NAMES[browseMonth]} {browseYear}
          </Text>
          <TouchableOpacity onPress={handleNextMonth} style={styles.sheetNavBtn}>
            <Icon name="chevron-right" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <MonthGrid
          currentYear={browseYear}
          currentMonth={browseMonth}
          selectedDate={date}
          events={[]}
          onDateSelect={handleSelect}
          expanded
        />
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flex: 1,
  },
  textArea: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  label: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  value: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  sheetNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  sheetNavBtn: {
    padding: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetNavTitle: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
});
