/**
 * TimePickerSheet — Bottom sheet with custom 24h time input + scrollable slots.
 *
 * Top section: TextInput for typing time in 24-hour format (e.g., "14:30").
 *   Auto-formats as user types, validates on Set press.
 * Bottom section: Scrollable list of 48 half-hour slots (00:00 → 23:30).
 *   Tapping a slot selects it and closes. Current selection highlighted in gold.
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import { BottomSheet } from '../../common';
import {
  TIME_SLOTS,
  parseTimeInput24h,
  autoFormatTimeInput,
} from '../../../utils/calendarUtils';

interface TimePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  selectedHour: number;
  selectedMinute: number;
  onSelect: (hour: number, minute: number) => void;
  title?: string;
}

export const TimePickerSheet: React.FC<TimePickerSheetProps> = ({
  visible,
  onClose,
  selectedHour,
  selectedMinute,
  onSelect,
  title = 'Select Time',
}) => {
  const listRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Custom input state
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState(false);

  // Reset input state when sheet opens
  useEffect(() => {
    if (visible) {
      // Pre-fill with current selected time in 24h format
      const h = String(selectedHour).padStart(2, '0');
      const m = String(selectedMinute).padStart(2, '0');
      setInputValue(`${h}:${m}`);
      setInputError(false);

      // Scroll to selected slot
      const index = TIME_SLOTS.findIndex(
        (s) => s.hour24 === selectedHour && s.minute === selectedMinute,
      );
      if (index >= 0) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({
            index,
            animated: false,
            viewPosition: 0.3,
          });
        }, 200);
      }
    }
  }, [visible, selectedHour, selectedMinute]);

  // Handle text input change with auto-formatting
  const handleInputChange = useCallback((text: string) => {
    const formatted = autoFormatTimeInput(text);
    setInputValue(formatted);
    setInputError(false);
  }, []);

  // Handle "Set" button press
  const handleSetPress = useCallback(() => {
    const parsed = parseTimeInput24h(inputValue);
    if (parsed) {
      setInputError(false);
      onSelect(parsed.hour, parsed.minute);
      onClose();
    } else {
      setInputError(true);
    }
  }, [inputValue, onSelect, onClose]);

  // Handle submit on keyboard "Done"
  const handleSubmitEditing = useCallback(() => {
    handleSetPress();
  }, [handleSetPress]);

  return (
    <BottomSheet visible={visible} onClose={onClose} title={title} maxHeight="70%">
      {/* Custom time input section */}
      <View style={styles.inputSection}>
        <Text style={styles.inputLabel}>Enter time (24h format)</Text>
        <View style={styles.inputRow}>
          <View
            style={[
              styles.inputWrapper,
              inputError && styles.inputWrapperError,
            ]}
          >
            <Icon
              name="schedule"
              size={20}
              color={inputError ? Colors.error : Colors.textSecondary}
            />
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              value={inputValue}
              onChangeText={handleInputChange}
              onSubmitEditing={handleSubmitEditing}
              placeholder="HH:MM"
              placeholderTextColor={Colors.textTertiary}
              keyboardType="number-pad"
              maxLength={5}
              returnKeyType="done"
              selectTextOnFocus
            />
          </View>
          <TouchableOpacity
            style={styles.setButton}
            onPress={handleSetPress}
            activeOpacity={0.7}
          >
            <Text style={styles.setButtonText}>Set</Text>
          </TouchableOpacity>
        </View>
        {inputError && (
          <Text style={styles.errorText}>
            Invalid time — use HH:MM (00:00 – 23:59)
          </Text>
        )}
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or select a time</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Slot list */}
      <FlatList
        ref={listRef}
        data={TIME_SLOTS}
        keyExtractor={(item) => item.value}
        getItemLayout={(_, index) => ({
          length: 48,
          offset: 48 * index,
          index,
        })}
        renderItem={({ item }) => {
          const isSelected =
            item.hour24 === selectedHour && item.minute === selectedMinute;
          return (
            <TouchableOpacity
              style={[styles.slot, isSelected && styles.slotActive]}
              onPress={() => {
                onSelect(item.hour24, item.minute);
                onClose();
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.slotTime24}>{item.value}</Text>
              <Text
                style={[
                  styles.slotLabel,
                  isSelected && styles.slotLabelActive,
                ]}
              >
                {item.label}
              </Text>
              {isSelected && (
                <Icon name="check" size={20} color={Colors.primary} />
              )}
            </TouchableOpacity>
          );
        }}
        onScrollToIndexFailed={() => {}}
      />
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  // Custom input section
  inputSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 48,
    gap: Spacing.sm,
  },
  inputWrapperError: {
    borderColor: Colors.error,
  },
  textInput: {
    flex: 1,
    ...Typography.h3,
    color: Colors.textPrimary,
    letterSpacing: 2,
    padding: 0,
  },
  setButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.xl,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.error,
    marginTop: Spacing.xs,
  },

  // Divider
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginHorizontal: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Slot list
  slot: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.md,
  },
  slotActive: {
    backgroundColor: Colors.primary + '20',
  },
  slotTime24: {
    ...Typography.body,
    color: Colors.textTertiary,
    width: 48,
    fontVariant: ['tabular-nums'],
  },
  slotLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  slotLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
