import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  title: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  content: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
});
