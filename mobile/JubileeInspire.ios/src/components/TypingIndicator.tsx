/**
 * Jubilee Inspire - Typing Indicator Component
 *
 * Animated typing indicator shown when AI is generating a response.
 * Supports "Thinking Mode" for extended reasoning visualization.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const jubileeProfile = require('../../assets/jubilee-profile.png');

interface TypingIndicatorProps {
  isThinking?: boolean; // When true, shows "Thinking deeply..." instead of dots
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isThinking = false }) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animateDot = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const animation = Animated.parallel([
      animateDot(dot1, 0),
      animateDot(dot2, 150),
      animateDot(dot3, 300),
    ]);

    animation.start();

    return () => animation.stop();
  }, [dot1, dot2, dot3]);

  const getDotStyle = (dot: Animated.Value) => ({
    opacity: dot.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 1],
    }),
    transform: [
      {
        scale: dot.interpolate({
          inputRange: [0, 1],
          outputRange: [1, 1.2],
        }),
      },
    ],
  });

  return (
    <View style={styles.container}>
      {/* Avatar */}
      <Image source={jubileeProfile} style={styles.avatar} />

      {/* Typing/Thinking Indicator */}
      <View style={styles.contentContainer}>
        <Text style={styles.roleLabel}>Jubilee Inspire</Text>
        {isThinking ? (
          <View style={styles.thinkingContainer}>
            <Ionicons name="bulb" size={16} color={colors.primary} style={styles.thinkingIcon} />
            <Text style={styles.thinkingText}>Thinking deeply</Text>
            <View style={styles.dotsContainer}>
              <Animated.View style={[styles.dot, styles.thinkingDot, getDotStyle(dot1)]} />
              <Animated.View style={[styles.dot, styles.thinkingDot, getDotStyle(dot2)]} />
              <Animated.View style={[styles.dot, styles.thinkingDot, getDotStyle(dot3)]} />
            </View>
          </View>
        ) : (
          <View style={styles.dotsContainer}>
            <Animated.View style={[styles.dot, getDotStyle(dot1)]} />
            <Animated.View style={[styles.dot, getDotStyle(dot2)]} />
            <Animated.View style={[styles.dot, getDotStyle(dot3)]} />
          </View>
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  roleLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.textSecondary,
    marginRight: 4,
  },
  thinkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  thinkingIcon: {
    marginRight: spacing.xs,
  },
  thinkingText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    fontWeight: '500',
    marginRight: spacing.xs,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 3,
  },
});

export default TypingIndicator;
