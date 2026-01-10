/**
 * Jubilee Inspire - Settings Screen
 *
 * User profile and app settings.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors, spacing, typography, APP_VERSION } from '../config';
import { RootStackParamList } from '../types';
import { storage } from '../services/storage';
import { ConfirmDialog } from '../components';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  danger = false,
}) => (
  <TouchableOpacity
    style={styles.settingsItem}
    onPress={onPress}
    activeOpacity={onPress ? 0.7 : 1}
    disabled={!onPress}
  >
    <View style={[styles.iconContainer, danger && styles.dangerIcon]}>
      <Ionicons
        name={icon}
        size={22}
        color={danger ? colors.error : colors.primary}
      />
    </View>
    <View style={styles.settingsContent}>
      <Text style={[styles.settingsTitle, danger && styles.dangerText]}>
        {title}
      </Text>
      {subtitle && <Text style={styles.settingsSubtitle}>{subtitle}</Text>}
    </View>
    {showArrow && onPress && (
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    )}
  </TouchableOpacity>
);

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const handleClearHistory = () => {
    console.log('[SettingsScreen] handleClearHistory called');
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    console.log('[SettingsScreen] Delete confirmed');
    setShowConfirmDialog(false);

    try {
      console.log('[SettingsScreen] Starting to clear conversations...');
      await storage.clearAll();
      console.log('[SettingsScreen] Storage cleared successfully');

      // Navigate back to close the settings modal
      console.log('[SettingsScreen] Navigating back...');
      navigation.goBack();

      // Then navigate to a new chat
      setTimeout(() => {
        console.log('[SettingsScreen] Navigating to new chat...');
        navigation.navigate('Chat', {
          conversationId: undefined,
          timestamp: Date.now()
        } as any);

        // Show success message
        setTimeout(() => {
          console.log('[SettingsScreen] Showing success dialog');
          setShowSuccessDialog(true);
        }, 300);
      }, 100);
    } catch (error) {
      console.error('[SettingsScreen] Error clearing conversations:', error);
      Alert.alert('Error', 'Failed to delete conversations. Please try again.');
    }
  };

  const handleCancelDelete = () => {
    console.log('[SettingsScreen] User cancelled deletion');
    setShowConfirmDialog(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        {/* User Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color="#ffffff" />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>Guest User</Text>
            <Text style={styles.profileEmail}>Sign in to sync your data</Text>
          </View>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon="log-in-outline"
              title="Sign In"
              subtitle="Sync conversations across devices"
              onPress={() => Alert.alert('Coming Soon', 'Sign in will be available in a future update.')}
            />
            <SettingsItem
              icon="cloud-upload-outline"
              title="Sync Data"
              subtitle="Last synced: Never"
              onPress={() => Alert.alert('Coming Soon', 'Cloud sync will be available in a future update.')}
            />
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon="book-outline"
              title="Bible Translation"
              subtitle="King James Version (KJV)"
              onPress={() => Alert.alert('Coming Soon', 'Translation selection will be available in a future update.')}
            />
            <SettingsItem
              icon="moon-outline"
              title="Appearance"
              subtitle="System default"
              onPress={() => Alert.alert('Coming Soon', 'Theme settings will be available in a future update.')}
            />
            <SettingsItem
              icon="notifications-outline"
              title="Notifications"
              subtitle="Daily verse reminders"
              onPress={() => Alert.alert('Coming Soon', 'Notification settings will be available in a future update.')}
            />
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Storage</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon="download-outline"
              title="Export Conversations"
              subtitle="Download your chat history"
              onPress={() => Alert.alert('Coming Soon', 'Export feature will be available in a future update.')}
            />
            <SettingsItem
              icon="trash-outline"
              title="Clear All Conversations"
              subtitle="Delete all chat history"
              onPress={handleClearHistory}
              danger
            />
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon="information-circle-outline"
              title="About Jubilee Inspire"
              subtitle={`Version ${APP_VERSION}`}
              showArrow={false}
            />
            <SettingsItem
              icon="document-text-outline"
              title="Terms of Service"
              onPress={() => Alert.alert('Terms of Service', 'Terms will be available at jubileeverse.com/terms')}
            />
            <SettingsItem
              icon="shield-checkmark-outline"
              title="Privacy Policy"
              onPress={() => Alert.alert('Privacy Policy', 'Privacy policy will be available at jubileeverse.com/privacy')}
            />
            <SettingsItem
              icon="help-circle-outline"
              title="Help & Support"
              onPress={() => Alert.alert('Help & Support', 'Visit jubileeverse.com/support for help')}
            />
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Jubilee Inspire {APP_VERSION}</Text>
          <Text style={styles.footerSubtext}>
            An Interactive AI Bible Experience
          </Text>
          <Text style={styles.copyright}>
            © 2024-2026 Jubilee Software, Inc.
          </Text>
        </View>
      </ScrollView>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        visible={showConfirmDialog}
        title="Delete All Conversations"
        message="All chat conversations will be permanently deleted and cannot be recovered. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor={colors.error}
        icon="trash-outline"
        iconColor={colors.error}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      {/* Success Dialog */}
      <ConfirmDialog
        visible={showSuccessDialog}
        title="Success"
        message="All conversations have been permanently deleted."
        confirmText="OK"
        cancelText=""
        confirmColor={colors.primary}
        icon="checkmark-circle-outline"
        iconColor={colors.primary}
        onConfirm={() => setShowSuccessDialog(false)}
        onCancel={() => setShowSuccessDialog(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    marginLeft: spacing.md,
    flex: 1,
  },
  profileName: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  profileEmail: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionContent: {
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  dangerIcon: {
    backgroundColor: `${colors.error}15`,
  },
  settingsContent: {
    flex: 1,
  },
  settingsTitle: {
    fontSize: typography.fontSize.base,
    color: colors.text,
  },
  dangerText: {
    color: colors.error,
  },
  settingsSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
    paddingHorizontal: spacing.lg,
  },
  footerText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text,
  },
  footerSubtext: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 4,
  },
  copyright: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
});

export default SettingsScreen;
