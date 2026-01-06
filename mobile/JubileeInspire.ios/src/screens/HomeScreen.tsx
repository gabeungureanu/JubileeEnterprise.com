/**
 * Jubilee Inspire - Home Screen
 *
 * Welcome screen introducing the app and providing navigation to Chat.
 * Note: This screen is currently unused as the app starts directly on ChatScreen.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, typography } from '../config';

const HomeScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleStartChat = () => {
    // @ts-expect-error Navigation typing simplified for unused screen
    navigation.navigate('Chat', { conversationId: undefined });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      <View style={styles.content}>
        {/* Logo/Icon Area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>JI</Text>
          </View>
        </View>

        {/* Title Section */}
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Jubilee Inspire</Text>
          <Text style={styles.subtitle}>
            An Interactive AI Bible Experience{'\n'}for Deeper Understanding of Scripture
          </Text>
        </View>

        {/* Features Preview */}
        <View style={styles.featuresContainer}>
          <FeatureItem
            icon="📖"
            title="Scripture Study"
            description="Explore the Bible with AI-guided insights"
          />
          <FeatureItem
            icon="💬"
            title="Ask Questions"
            description="Get answers to your biblical questions"
          />
          <FeatureItem
            icon="✨"
            title="Personal Growth"
            description="Deepen your faith through conversation"
          />
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleStartChat}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Start Conversation</Text>
        </TouchableOpacity>

        {/* Version info */}
        <Text style={styles.versionText}>Version 1.0.0</Text>
      </View>
    </SafeAreaView>
  );
};

// Feature Item Component
interface FeatureItemProps {
  icon: string;
  title: string;
  description: string;
}

const FeatureItem: React.FC<FeatureItemProps> = ({ icon, title, description }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <View style={styles.featureTextContainer}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  logoText: {
    fontSize: typography.fontSize['4xl'],
    fontWeight: 'bold',
    color: '#ffffff',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSize.base,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    width: '100%',
    marginBottom: spacing['2xl'],
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  featureIcon: {
    fontSize: 28,
    marginRight: spacing.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: typography.fontSize.sm,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 30,
    width: '100%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: colors.primary,
  },
  versionText: {
    marginTop: spacing.lg,
    fontSize: typography.fontSize.xs,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});

export default HomeScreen;
