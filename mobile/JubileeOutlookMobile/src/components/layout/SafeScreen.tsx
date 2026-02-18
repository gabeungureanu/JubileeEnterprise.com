/**
 * SafeScreen — Centralized safe-area wrapper for all screens.
 *
 * Uses SafeAreaView from react-native-safe-area-context to dynamically
 * inset content away from device system bars (status bar, notch, home
 * indicator, gesture nav bar).
 *
 * Usage:
 *   Tabbed screens (bottom tab bar handles bottom inset):
 *     <SafeScreen edges={['top']}>
 *
 *   Full screens (auth, modals without tab bar):
 *     <SafeScreen edges={['top', 'bottom']}>
 */
import React from 'react';
import type { ViewStyle, StyleProp } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { Colors } from '../../constants/colors';

interface SafeScreenProps {
  children: React.ReactNode;
  /** Which edges to inset. Defaults to ['top']. */
  edges?: Edge[];
  /** Additional style applied to the SafeAreaView container. */
  style?: StyleProp<ViewStyle>;
}

export function SafeScreen({
  children,
  edges = ['top'],
  style,
}: SafeScreenProps) {
  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: Colors.background }, style]}
    >
      {children}
    </SafeAreaView>
  );
}
