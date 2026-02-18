import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';

interface AppHeaderProps {
  title: string;
  leftIcon?: string;
  onLeftPress?: () => void;
  rightIcon?: string;
  onRightPress?: () => void;
  rightIcon2?: string;
  onRightPress2?: () => void;
  subtitle?: string;
}

export function AppHeader({
  title,
  leftIcon,
  onLeftPress,
  rightIcon,
  onRightPress,
  rightIcon2,
  onRightPress2,
  subtitle,
}: AppHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
      <View style={styles.row}>
        {leftIcon && onLeftPress ? (
          <TouchableOpacity onPress={onLeftPress} style={styles.iconButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Icon name={leftIcon as any} size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.iconButton} />
        )}

        <View style={styles.titleContainer}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {subtitle && <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>}
        </View>

        <View style={styles.rightActions}>
          {rightIcon2 && onRightPress2 && (
            <TouchableOpacity onPress={onRightPress2} style={styles.iconButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name={rightIcon2 as any} size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          {rightIcon && onRightPress && (
            <TouchableOpacity onPress={onRightPress} style={styles.iconButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Icon name={rightIcon as any} size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontSize: 17,
  },
  subtitle: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  rightActions: {
    flexDirection: 'row',
  },
});
