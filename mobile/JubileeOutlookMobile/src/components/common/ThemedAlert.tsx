/**
 * ThemedAlert — Custom alert dialog styled with the app's dark theme.
 *
 * Replaces the native Alert.alert() with a Modal that uses
 * Colors, Typography, Spacing, and BorderRadius for consistency.
 *
 * Supports: info, success, error, warning, and confirm variants.
 * Each variant renders a matching icon and accent color.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';

// ---------- Types ----------

export type AlertVariant = 'info' | 'success' | 'error' | 'warning' | 'confirm';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface ThemedAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  variant?: AlertVariant;
  buttons?: AlertButton[];
  onDismiss: () => void;
}

// ---------- Variant Config ----------

const VARIANT_CONFIG: Record<AlertVariant, { icon: string; color: string }> = {
  info: { icon: 'info', color: Colors.accent },
  success: { icon: 'check-circle', color: Colors.success },
  error: { icon: 'error', color: Colors.error },
  warning: { icon: 'warning', color: Colors.warning },
  confirm: { icon: 'help', color: Colors.primary },
};

// ---------- Component ----------

export function ThemedAlert({
  visible,
  title,
  message,
  variant = 'info',
  buttons,
  onDismiss,
}: ThemedAlertProps) {
  const { icon, color } = VARIANT_CONFIG[variant];

  const resolvedButtons: AlertButton[] =
    buttons && buttons.length > 0
      ? buttons
      : [{ text: 'OK', onPress: onDismiss, style: 'default' }];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.dialog} onPress={() => {}}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: color + '1A' }]}>
            <Icon name={icon as any} size={28} color={color} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {resolvedButtons.map((btn, idx) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              const isPrimary = !isCancel && !isDestructive;

              return (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.button,
                    isPrimary && { backgroundColor: color },
                    isCancel && styles.buttonCancel,
                    isDestructive && styles.buttonDestructive,
                    resolvedButtons.length === 1 && styles.buttonFull,
                  ]}
                  onPress={() => {
                    btn.onPress?.();
                    onDismiss();
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isPrimary && styles.buttonTextPrimary,
                      isCancel && styles.buttonTextCancel,
                      isDestructive && styles.buttonTextDestructive,
                    ]}
                  >
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxxl,
  },
  dialog: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    paddingHorizontal: Spacing.xxl,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.sm,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonFull: {
    flex: 1,
  },
  buttonCancel: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonDestructive: {
    backgroundColor: Colors.error,
  },
  buttonText: {
    ...Typography.button,
  },
  buttonTextPrimary: {
    color: Colors.textInverse,
  },
  buttonTextCancel: {
    color: Colors.textSecondary,
  },
  buttonTextDestructive: {
    color: Colors.white,
  },
});
