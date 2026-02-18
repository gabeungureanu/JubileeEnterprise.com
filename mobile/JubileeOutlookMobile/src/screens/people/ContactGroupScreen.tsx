/**
 * ContactGroupScreen — Placeholder screen for viewing contact group members.
 * Receives groupId and groupName from route params.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PeopleStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';

type Props = NativeStackScreenProps<PeopleStackParamList, 'ContactGroup'>;

export default function ContactGroupScreen({ route }: Props) {
  const { groupName } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon name="group" size={64} color={Colors.textSecondary} />
      </View>
      <Text style={styles.title}>{groupName}</Text>
      <Text style={styles.subtitle}>
        Group member viewing coming in a future update.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
