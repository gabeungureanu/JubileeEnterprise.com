/**
 * AttendeeInput — Text input with removable chip display for attendees.
 *
 * Type a name/email and press Enter or ";" to add as a chip.
 * Tap the X on a chip to remove it.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import { useAlert } from '../../../hooks';

interface AttendeeInputProps {
  attendees: string[];
  onAdd: (attendee: string) => void;
  onRemove: (index: number) => void;
}

export const AttendeeInput: React.FC<AttendeeInputProps> = ({
  attendees,
  onAdd,
  onRemove,
}) => {
  const [text, setText] = useState('');
  const { confirm, AlertComponent } = useAlert();

  const handleRemove = useCallback(
    (idx: number) => {
      const name = attendees[idx] || 'this attendee';
      confirm(
        'Remove Attendee',
        `Are you sure you want to remove "${name}"?`,
        () => onRemove(idx),
        { confirmText: 'Remove', destructive: true },
      );
    },
    [attendees, onRemove, confirm],
  );

  const addAttendee = useCallback(
    (raw: string) => {
      const trimmed = raw.trim().replace(/[;,]$/, '').trim();
      if (trimmed && !attendees.includes(trimmed)) {
        onAdd(trimmed);
      }
      setText('');
    },
    [attendees, onAdd],
  );

  const handleChangeText = useCallback(
    (value: string) => {
      // Auto-add when user types semicolon or comma
      if (value.endsWith(';') || value.endsWith(',')) {
        addAttendee(value);
        return;
      }
      setText(value);
    },
    [addAttendee],
  );

  const handleSubmit = useCallback(() => {
    if (text.trim()) addAttendee(text);
  }, [text, addAttendee]);

  return (
    <>
      <View style={styles.container}>
        {/* Chips */}
        {attendees.length > 0 && (
          <View style={styles.chipRow}>
            {attendees.map((att, idx) => (
              <View key={`${att}-${idx}`} style={styles.chip}>
                <Text style={styles.chipText} numberOfLines={1}>
                  {att}
                </Text>
                <TouchableOpacity
                  onPress={() => handleRemove(idx)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon name="close" size={16} color={Colors.textTertiary} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Input */}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          onSubmitEditing={handleSubmit}
          placeholder="Add attendee (name or email)"
          placeholderTextColor={Colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="done"
        />
      </View>
      {AlertComponent}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    maxWidth: '90%',
  },
  chipText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    ...Typography.body,
  },
});
