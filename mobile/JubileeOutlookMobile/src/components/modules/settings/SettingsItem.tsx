import React from 'react';
import { StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';

interface SettingsItemProps {
  icon?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  showChevron?: boolean;
  switchValue?: boolean;
  onSwitchChange?: (value: boolean) => void;
}

export function SettingsItem({
  icon,
  label,
  value,
  onPress,
  isDestructive = false,
  showChevron = true,
  switchValue,
  onSwitchChange,
}: SettingsItemProps) {
  const labelColor = isDestructive ? Colors.error : Colors.textPrimary;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={!onPress && !onSwitchChange}
      activeOpacity={0.7}
    >
      {icon && (
        <Icon
          name={icon}
          size={22}
          color={isDestructive ? Colors.error : Colors.textSecondary}
          style={styles.icon}
        />
      )}
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      {value && <Text style={styles.value}>{value}</Text>}
      {onSwitchChange !== undefined && switchValue !== undefined && (
        <Switch
          value={switchValue}
          onValueChange={onSwitchChange}
          trackColor={{ false: Colors.surfaceLight, true: Colors.primaryDark }}
          thumbColor={switchValue ? Colors.primary : Colors.textTertiary}
        />
      )}
      {showChevron && onPress && onSwitchChange === undefined && (
        <Icon name="chevron-right" size={22} color={Colors.textTertiary} />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
    minHeight: 48,
  },
  icon: {
    marginRight: Spacing.md,
  },
  label: {
    ...Typography.body,
    flex: 1,
  },
  value: {
    ...Typography.body,
    color: Colors.textTertiary,
    marginRight: Spacing.sm,
  },
});
