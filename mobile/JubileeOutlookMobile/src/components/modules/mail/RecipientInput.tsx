import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';

interface RecipientInputProps {
  label: string;
  recipients: string[];
  onAdd: (email: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
}

export function RecipientInput({
  label,
  recipients,
  onAdd,
  onRemove,
  placeholder = 'Add recipient...',
}: RecipientInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = () => {
    const email = inputValue.trim();
    if (email && email.includes('@')) {
      onAdd(email);
      setInputValue('');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}:</Text>
      <View style={styles.chipsContainer}>
        {recipients.map((email, index) => (
          <View key={`${email}-${index}`} style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>{email}</Text>
            <TouchableOpacity onPress={() => onRemove(index)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
              <Icon name="close" size={14} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
        <TextInput
          style={styles.input}
          value={inputValue}
          onChangeText={setInputValue}
          placeholder={recipients.length === 0 ? placeholder : ''}
          placeholderTextColor={Colors.textTertiary}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={handleSubmit}
          blurOnSubmit={false}
          returnKeyType="next"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  label: {
    ...Typography.label,
    color: Colors.textTertiary,
    width: 36,
    paddingTop: Spacing.sm,
  },
  chipsContainer: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
    maxWidth: 200,
  },
  chipText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
  },
  input: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    minWidth: 100,
    paddingVertical: Spacing.xs,
  },
});
