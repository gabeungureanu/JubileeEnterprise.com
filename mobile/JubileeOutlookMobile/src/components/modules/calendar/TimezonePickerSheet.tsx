/**
 * TimezonePickerSheet — Bottom sheet with common timezone options.
 *
 * Matches web frontend's timezone list. Tapping selects and closes.
 */
import React from 'react';
import { FlatList, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import { BottomSheet } from '../../common';
import { TIMEZONE_OPTIONS } from '../../../utils/calendarUtils';

interface TimezonePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  selected: string;
  onSelect: (timezone: string) => void;
}

export const TimezonePickerSheet: React.FC<TimezonePickerSheetProps> = ({
  visible,
  onClose,
  selected,
  onSelect,
}) => {
  return (
    <BottomSheet visible={visible} onClose={onClose} title="Select Timezone" maxHeight="60%">
      <FlatList
        data={TIMEZONE_OPTIONS}
        keyExtractor={(item) => item}
        renderItem={({ item }) => {
          const isSelected = item === selected;
          return (
            <TouchableOpacity
              style={[styles.row, isSelected && styles.rowActive]}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.text, isSelected && styles.textActive]}>{item}</Text>
              {isSelected && <Icon name="check" size={20} color={Colors.primary} />}
            </TouchableOpacity>
          );
        }}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  rowActive: {
    backgroundColor: Colors.primary + '15',
  },
  text: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  textActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
