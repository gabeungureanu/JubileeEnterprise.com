import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';

interface BadgeProps {
  count: number;
  maxCount?: number;
  color?: string;
  size?: 'small' | 'medium';
}

export function Badge({ count, maxCount = 99, color = Colors.accent, size = 'medium' }: BadgeProps) {
  if (count <= 0) return null;

  const displayText = count > maxCount ? `${maxCount}+` : count.toString();
  const isSmall = size === 'small';

  return (
    <View style={[styles.container, { backgroundColor: color }, isSmall && styles.containerSmall]}>
      <Text style={[styles.text, isSmall && styles.textSmall]}>{displayText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containerSmall: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
  },
  text: {
    ...Typography.caption,
    color: Colors.white,
    fontWeight: '700',
    fontSize: 11,
  },
  textSmall: {
    fontSize: 9,
  },
});
