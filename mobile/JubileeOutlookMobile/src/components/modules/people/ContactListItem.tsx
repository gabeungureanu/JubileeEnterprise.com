import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Avatar } from '../../common/Avatar';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import type { Contact } from '../../../types';

interface ContactListItemProps {
  contact: Contact;
  onPress: () => void;
  onToggleFavorite?: () => void;
}

export function ContactListItem({ contact, onPress, onToggleFavorite }: ContactListItemProps) {
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(' at ');

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <Avatar name={contact.displayName} imageUrl={contact.photoUrl} size={44} />
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>{contact.displayName}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
        ) : contact.emailAddresses?.[0] ? (
          <Text style={styles.subtitle} numberOfLines={1}>{contact.emailAddresses[0]}</Text>
        ) : null}
      </View>
      {onToggleFavorite && (
        <TouchableOpacity
          onPress={onToggleFavorite}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Icon
            name={contact.isFavorite ? 'star' : 'star-border'}
            size={22}
            color={contact.isFavorite ? Colors.primary : Colors.textTertiary}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  name: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
  subtitle: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: 1,
  },
});
