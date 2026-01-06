/**
 * Jubilee Inspire - Empty Chat Component
 *
 * Shown when starting a new conversation with no messages.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../config';

const jubileeProfile = require('../../assets/jubilee-profile.png');

interface SuggestionItem {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  prompt: string;
}

interface EmptyChatProps {
  onSuggestionPress: (prompt: string) => void;
}

const suggestions: SuggestionItem[] = [
  {
    icon: 'book-outline',
    title: 'Explain a passage',
    prompt: 'Can you explain the meaning of John 3:16 and its significance?',
  },
  {
    icon: 'help-circle-outline',
    title: 'Answer a question',
    prompt: 'What does the Bible say about forgiveness?',
  },
  {
    icon: 'compass-outline',
    title: 'Guide my study',
    prompt: 'Help me create a Bible reading plan for understanding grace.',
  },
  {
    icon: 'heart-outline',
    title: 'Daily devotional',
    prompt: 'Give me an encouraging verse and reflection for today.',
  },
];

const EmptyChat: React.FC<EmptyChatProps> = ({ onSuggestionPress }) => {
  return (
    <View style={styles.container}>
      {/* Logo */}
      <View style={styles.logoContainer}>
        <Image source={jubileeProfile} style={styles.logo} />
      </View>

      {/* Title */}
      <Text style={styles.title}>How can I help you today?</Text>
      <Text style={styles.subtitle}>
        Ask me anything about Scripture, faith, or spiritual growth.
      </Text>

      {/* Suggestions Grid */}
      <View style={styles.suggestionsContainer}>
        {suggestions.map((suggestion, index) => (
          <TouchableOpacity
            key={index}
            style={styles.suggestionCard}
            onPress={() => onSuggestionPress(suggestion.prompt)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={suggestion.icon}
              size={20}
              color={colors.primary}
              style={styles.suggestionIcon}
            />
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
    backgroundColor: colors.background,
  },
  logoContainer: {
    marginBottom: spacing.lg,
  },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  title: {
    fontSize: typography.fontSize['2xl'],
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 300,
  },
  suggestionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    maxWidth: 400,
  },
  suggestionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 150,
    maxWidth: 180,
  },
  suggestionIcon: {
    marginRight: spacing.sm,
  },
  suggestionTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
});

export default EmptyChat;
