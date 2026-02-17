import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  iconSize?: number;
}

export function EmptyState({ icon, title, subtitle, iconSize = 64 }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={iconSize} color={Colors.textTertiary} />
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  title: {
    ...Typography.h3,
    color: Colors.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginTop: 8,
    textAlign: 'center',
  },
});
