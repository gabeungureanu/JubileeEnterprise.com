/**
 * ThemedToast — Centered boxy auto-dismiss notification.
 *
 * Simple fade in/out at centre of screen. Shows icon + title + subtitle
 * for ~2.5 s then disappears. No overlay, no buttons, no tap needed.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ThemedToastProps {
  visible: boolean;
  title: string;
  message?: string;
  variant?: ToastVariant;
  onHide: () => void;
  duration?: number;
}

const VARIANT_CONFIG: Record<ToastVariant, { icon: string; color: string }> = {
  success: { icon: 'check-circle-outline', color: Colors.success },
  error: { icon: 'error-outline', color: Colors.error },
  warning: { icon: 'warning', color: Colors.warning },
  info: { icon: 'info-outline', color: Colors.accent },
};

export function ThemedToast({
  visible,
  title,
  message,
  variant = 'info',
  onHide,
  duration = 2500,
}: ThemedToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();

      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => onHide());
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  const { icon, color } = VARIANT_CONFIG[variant];

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[styles.box, { opacity }]}>
        <View style={[styles.iconCircle, { backgroundColor: color + '20' }]}>
          <Icon name={icon as any} size={28} color={color} />
        </View>
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  box: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xxxl,
    alignItems: 'center',
    minWidth: 180,
    maxWidth: 260,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.label,
    color: Colors.textPrimary,
    textAlign: 'center',
    fontSize: 15,
  },
  message: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
