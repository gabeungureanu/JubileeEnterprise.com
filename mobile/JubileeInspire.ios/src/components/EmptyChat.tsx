/**
 * Jubilee Inspire - Empty Chat Component
 *
 * Shown when starting a new conversation with no messages.
 */

import React from 'react';
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const jubileeProfile = require('../../assets/jubilee-profile.png');

interface EmptyChatProps {
  onSuggestionPress?: (prompt: string) => void;
}

const EmptyChat: React.FC<EmptyChatProps> = () => {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  // Calculate responsive font size based on screen width
  // Base size 88px for screens >= 768px, scales down for smaller screens
  const baseFontSize = width >= 768 ? 88 : Math.max(32, Math.floor(width * 0.1));

  const styles = createStyles(colors, baseFontSize);

  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image source={jubileeProfile} style={styles.logo} />
      </View>

      {/* Title */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>Jubilee</Text>
        <Text style={styles.titleHighlight}>Inspire</Text>
        <Text style={styles.title}>.com</Text>
      </View>
    </View>
  );
};

const createStyles = (colors: any, fontSize: number) => StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 5,
    backgroundColor: colors.background,
  },
  logoContainer: {
    marginBottom: 5,
  },
  logo: {
    width: 150,
    height: 150,
    borderRadius: 75,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize,
    fontFamily: 'Agency FB',
    fontWeight: '600',
    color: colors.logoText,
  },
  titleHighlight: {
    fontSize: fontSize,
    fontFamily: 'Agency FB',
    fontWeight: '600',
    color: '#ffbd59',
  },
});

export default EmptyChat;
