/**
 * AttendeeInput — Text input with removable chip display for attendees.
 *
 * Type a name/email and press Enter or ";" to add as a chip.
 * Tap the X on a chip to remove it.
 * Searches contacts in real-time (debounced) and shows dropdown suggestions.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import { useAlert } from '../../../hooks';
import { contactService } from '../../../services/contacts/contactService';
import type { Contact } from '../../../types/contacts';

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
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { confirm, AlertComponent } = useAlert();

  // Clean up debounce timer
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleRemove = useCallback(
    (idx: number) => {
      const name = attendees[idx] || 'this attendee';
      confirm(
        'Remove Attendee',
        `Are you sure you want to remove "${name}"?`,
        () => onRemove(idx),
        { confirmText: 'Remove', destructive: true, icon: 'person-remove' },
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
      setSuggestions([]);
      setShowSuggestions(false);
    },
    [attendees, onAdd],
  );

  const handleSelectSuggestion = useCallback(
    (contact: Contact) => {
      // Use display name as the attendee chip value
      addAttendee(contact.displayName);
    },
    [addAttendee],
  );

  const searchContacts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    try {
      const result = await contactService.searchContacts(query, 1, 10);
      setSuggestions(result.contacts);
      setShowSuggestions(result.contacts.length > 0);
    } catch {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, []);

  const handleChangeText = useCallback(
    (value: string) => {
      // Auto-add when user types semicolon or comma
      if (value.endsWith(';') || value.endsWith(',')) {
        addAttendee(value);
        return;
      }
      setText(value);

      // Debounced contact search (300ms)
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchContacts(value.trim());
      }, 300);
    },
    [addAttendee, searchContacts],
  );

  const handleSubmit = useCallback(() => {
    if (text.trim()) addAttendee(text);
  }, [text, addAttendee]);

  const getInitials = (name: string): string => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const renderSuggestion = useCallback(
    ({ item }: { item: Contact }) => {
      const email = item.emailAddresses?.[0] || '';
      return (
        <TouchableOpacity
          style={styles.suggestionRow}
          onPress={() => handleSelectSuggestion(item)}
          activeOpacity={0.7}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getInitials(item.displayName)}</Text>
          </View>
          <View style={styles.suggestionInfo}>
            <Text style={styles.suggestionName} numberOfLines={1}>
              {item.displayName}
            </Text>
            {email ? (
              <Text style={styles.suggestionEmail} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectSuggestion],
  );

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

        {/* Contact suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={suggestions}
              keyExtractor={(item) => item.id}
              renderItem={renderSuggestion}
              keyboardShouldPersistTaps="handled"
              style={styles.suggestionsList}
              nestedScrollEnabled
            />
          </View>
        )}
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
  suggestionsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.caption,
    color: Colors.textInverse,
    fontWeight: '600',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  suggestionEmail: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});
