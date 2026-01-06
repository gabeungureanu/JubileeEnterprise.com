/**
 * Jubilee Inspire - Typing Indicator Component
 *
 * Animated typing indicator shown when AI is generating a response.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { colors, spacing, typography } from '../config';

const jubileeProfile = require('../../assets/jubilee-profile.png');

const TypingIndicator: React.FC = () => {
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

      {/* Typing Indicator */}
      <View style={styles.contentContainer}>
        <Text style={styles.roleLabel}>Jubilee Inspire</Text>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, getDotStyle(dot1)]} />
          <Animated.View style={[styles.dot, getDotStyle(dot2)]} />
          <Animated.View style={[styles.dot, getDotStyle(dot3)]} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
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
});

export default TypingIndicator;
