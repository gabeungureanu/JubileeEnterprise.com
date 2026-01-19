/**
 * Jubilee Inspire - Settings Screen
 *
 * User profile and app settings.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { spacing, typography, APP_VERSION } from '../config';
import { RootStackParamList } from '../types';
import { storage } from '../services/storage';
import { ConfirmDialog } from '../components';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

// Helper function to get initials from a name
const getInitials = (name: string): string => {
  if (!name) return 'GU';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// Helper function to get first name from display name
const getFirstName = (name: string): string => {
  if (!name) return 'Guest';
  const words = name.trim().split(/\s+/);
  return words[0];
};

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

interface SettingsItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
  colors: any;
  styles: any;
}

const SettingsItem: React.FC<SettingsItemProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  danger = false,
  colors,
  styles,
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
  const { colors, getThemeDisplayName } = useTheme();
  const { user, isAuthenticated } = useAuth();
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showTermsOfUse, setShowTermsOfUse] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // Get user display info
  const displayName = user?.displayName || 'Guest';
  const userInitials = getInitials(displayName);
  const firstName = getFirstName(displayName);
  const subscriptionTier = isAuthenticated ? 'Premium' : 'Free';

  // Inject themed scrollbar CSS for web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'settings-scrollbar-style';
      let styleEl = document.getElementById(styleId);

      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      styleEl.textContent = `
        .themed-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .themed-scrollbar::-webkit-scrollbar-track {
          background: ${colors.surface};
          border-radius: 4px;
        }
        .themed-scrollbar::-webkit-scrollbar-thumb {
          background: ${colors.border};
          border-radius: 4px;
        }
        .themed-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${colors.textSecondary};
        }
      `;

      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }
  }, [colors]);

  const handleClearHistory = () => {
    console.log('[SettingsScreen] handleClearHistory called');
    setShowConfirmDialog(true);
  };

  const handleConfirmDelete = async () => {
    console.log('[SettingsScreen] Delete confirmed');
    setShowConfirmDialog(false);

    try {
      console.log('[SettingsScreen] Starting to clear conversations...');

      // Clear all conversations and pending conversation
      await storage.clearAll();
      console.log('[SettingsScreen] Storage cleared successfully');

      // Close the settings modal immediately
      navigation.goBack();

      // Use a small delay to allow the modal to close, then navigate to new chat
      setTimeout(() => {
        console.log('[SettingsScreen] Navigating to new chat with force reload...');

        // Navigate to a new chat with a unique timestamp to force reload
        // This will trigger the ChatScreen to create a new pending conversation
        navigation.navigate('Chat', {
          conversationId: undefined,
          timestamp: Date.now()
        } as any);
      }, 200);

    } catch (error) {
      console.error('[SettingsScreen] Error clearing conversations:', error);
      Alert.alert('Error', 'Failed to delete conversations. Please try again.');
    }
  };

  const handleCancelDelete = () => {
    console.log('[SettingsScreen] User cancelled deletion');
    setShowConfirmDialog(false);
  };

  const styles = createStyles(colors);

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
          <View style={styles.avatarInitials}>
            <Text style={styles.initialsText}>{userInitials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileFirstName}>{firstName}</Text>
            <Text style={styles.profileSubtitle}>{subscriptionTier}</Text>
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
              colors={colors}
              styles={styles}
            />
            <SettingsItem
              icon="moon-outline"
              title="Appearance"
              subtitle={getThemeDisplayName()}
              onPress={() => navigation.navigate('Appearance')}
              colors={colors}
              styles={styles}
            />
          </View>
        </View>

        {/* Data Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data & Storage</Text>
          <View style={styles.sectionContent}>
            <SettingsItem
              icon="trash-outline"
              title="Clear All Conversations"
              subtitle="Delete all chat history"
              onPress={handleClearHistory}
              danger
              colors={colors}
              styles={styles}
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
              colors={colors}
              styles={styles}
            />
            <SettingsItem
              icon="document-text-outline"
              title="Terms of Use"
              onPress={() => setShowTermsOfUse(true)}
              colors={colors}
              styles={styles}
            />
            <SettingsItem
              icon="shield-checkmark-outline"
              title="Privacy Policy"
              onPress={() => setShowPrivacyPolicy(true)}
              colors={colors}
              styles={styles}
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

      {/* Terms of Use Modal */}
      <Modal
        visible={showTermsOfUse}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTermsOfUse(false)}
      >
        <View style={styles.termsModalOverlay}>
          <View style={styles.termsModalContainer}>
            {/* Header with close button */}
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>Terms of Use (EULA)</Text>
              <TouchableOpacity
                style={styles.termsCloseButton}
                onPress={() => setShowTermsOfUse(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Scrollable content */}
            <ScrollView
              style={styles.termsContent}
              showsVerticalScrollIndicator={true}
              {...(Platform.OS === 'web' ? { className: 'themed-scrollbar' } as any : {})}
            >
              <Text style={styles.termsIntro}>
                These Terms of Use (the "Agreement") govern your access to and use of the JubileeInspire mobile application ("App") provided by the app developer ("we," "us," or "our"). By downloading, installing, or using this App, you agree to be bound by this Agreement and comply with all applicable laws and regulations. If you do not agree to these terms, do not use the App.
              </Text>

              <Text style={styles.termsSectionTitle}>1. Intellectual Property</Text>
              <Text style={styles.termsText}>
                All content, including but not limited to software, text, graphics, images, layouts, databases, and logos ("Materials"), is the property of the developer or its content suppliers and is protected by United States and international copyright, trademark, and intellectual property laws. Unauthorized use of any Materials is strictly prohibited.
              </Text>
              <Text style={styles.termsText}>
                You may not reproduce, republish, distribute, display, modify, create derivative works from, transmit, or exploit any part of this App without prior written permission, except as explicitly permitted under this Agreement.
              </Text>

              <Text style={styles.termsSectionTitle}>2. License Grant and Restrictions</Text>
              <Text style={styles.termsText}>
                We grant you a limited, non-exclusive, non-transferable, revocable license to use the App solely for your personal, non-commercial use on an Apple-branded device owned or controlled by you.
              </Text>
              <Text style={styles.termsText}>You agree not to:</Text>
              <Text style={styles.termsBullet}>• Modify, reverse engineer, decompile, or disassemble the App</Text>
              <Text style={styles.termsBullet}>• Reproduce, distribute, or publicly display content without authorization</Text>
              <Text style={styles.termsBullet}>• Access or use the App for unlawful, harmful, or disruptive purposes</Text>
              <Text style={styles.termsBullet}>• Interfere with the App's operation or attempt to breach its security</Text>
              <Text style={styles.termsBullet}>• Use automated tools (bots, spiders, etc.) to interact with the App</Text>
              <Text style={styles.termsText}>
                This license is automatically terminated if you violate any part of this Agreement.
              </Text>

              <Text style={styles.termsSectionTitle}>3. User Content and Feedback</Text>
              <Text style={styles.termsText}>
                Any content or feedback you submit to us through the App or related services (e.g., suggestions, improvements, testimonials) shall be considered non-confidential. You grant us an unrestricted, irrevocable, worldwide license to use such content for business, marketing, or development purposes without compensation or acknowledgment.
              </Text>

              <Text style={styles.termsSectionTitle}>4. Privacy and Data Collection</Text>
              <Text style={styles.termsText}>
                Use of the App is governed by our Privacy Policy, which outlines how we collect, store, and use your data. By using the App, you consent to these data practices, including any updates.
              </Text>

              <Text style={styles.termsSectionTitle}>5. Auto-Renewable Subscriptions</Text>
              <Text style={styles.termsText}>JubileeInspire offers auto-renewable subscription plans:</Text>
              <Text style={styles.termsBullet}>• Standard Edition: $19.99/month</Text>
              <Text style={styles.termsBullet}>• Professional Edition: $49.99/month</Text>
              <Text style={styles.termsText}>
                Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period. Manage subscriptions via your Apple ID account settings. We do not process or store payment data; Apple handles all billing securely through In-App Purchase.
              </Text>

              <Text style={styles.termsSectionTitle}>6. Links to External Sites</Text>
              <Text style={styles.termsText}>
                The App may contain links to third-party websites or services. We are not responsible for the content, security, or practices of those third parties. Access them at your own risk.
              </Text>

              <Text style={styles.termsSectionTitle}>7. Security and Account Responsibility</Text>
              <Text style={styles.termsText}>
                You are responsible for maintaining the confidentiality of your account credentials and all activity that occurs under your account. Notify us immediately if you suspect unauthorized access. You may not disrupt or attempt to disrupt the functioning of the App or access data you are not authorized to access.
              </Text>

              <Text style={styles.termsSectionTitle}>8. Usage Restrictions and Prohibited Conduct</Text>
              <Text style={styles.termsText}>You agree not to:</Text>
              <Text style={styles.termsBullet}>• Post or transmit unlawful, offensive, or harmful content</Text>
              <Text style={styles.termsBullet}>• Infringe on the intellectual property or rights of others</Text>
              <Text style={styles.termsBullet}>• Introduce viruses or malicious code</Text>
              <Text style={styles.termsBullet}>• Violate local, national, or international laws</Text>
              <Text style={styles.termsText}>
                Violations may result in suspension or termination of your account and possible legal action.
              </Text>

              <Text style={styles.termsSectionTitle}>9. U.S. Government Restricted Rights</Text>
              <Text style={styles.termsText}>
                If accessed by or on behalf of the United States Government, the App and Materials are provided with "RESTRICTED RIGHTS." Use, duplication, or disclosure is subject to applicable laws, including FAR 52.227-19 and DFARS 252.227-7013.
              </Text>

              <Text style={styles.termsSectionTitle}>10. Indemnification</Text>
              <Text style={styles.termsText}>
                You agree to defend, indemnify, and hold harmless the developer, its affiliates, officers, and employees from any claims, liabilities, or expenses (including legal fees) resulting from your use of the App or your breach of this Agreement.
              </Text>

              <Text style={styles.termsSectionTitle}>11. Disclaimer of Warranties</Text>
              <Text style={styles.termsText}>
                The App and all Materials are provided "as is" without warranties of any kind, either express or implied. We make no guarantees regarding availability, functionality, or content accuracy. We disclaim all warranties including those of merchantability, fitness for a particular purpose, and non-infringement.
              </Text>
              <Text style={styles.termsText}>
                Some jurisdictions do not allow disclaimers of implied warranties. In such cases, the above limitations may not apply to you.
              </Text>

              <Text style={styles.termsSectionTitle}>12. Limitation of Liability</Text>
              <Text style={styles.termsText}>
                To the maximum extent permitted by law, we are not liable for any indirect, incidental, special, or consequential damages, including lost profits or data, arising from your use or inability to use the App. Our total liability shall not exceed $25.00.
              </Text>

              <Text style={styles.termsSectionTitle}>13. Termination</Text>
              <Text style={styles.termsText}>
                We may terminate your access to the App at any time, with or without cause. Upon termination, you must cease all use and uninstall the App from your device.
              </Text>

              <Text style={styles.termsSectionTitle}>14. Modifications</Text>
              <Text style={styles.termsText}>
                We may revise this Agreement at any time. Updates will be posted in the App or on our official website. Continued use after changes constitutes your acceptance of the revised terms.
              </Text>

              <Text style={styles.termsSectionTitle}>15. Governing Law and Jurisdiction</Text>
              <Text style={styles.termsText}>
                This Agreement is governed by the laws of the State of California, without regard to its conflict of law provisions. All disputes shall be resolved exclusively in the state or federal courts located in Sacramento, California.
              </Text>

              <Text style={styles.termsSectionTitle}>16. Contact Us</Text>
              <Text style={styles.termsText}>
                If you have questions or concerns regarding these Terms of Use, please contact:
              </Text>
              <Text style={styles.termsContact}>JubileeInspire Support Team</Text>
              <Text style={styles.termsContact}>Email: support@jubileeinspire.com</Text>
              <Text style={styles.termsContact}>Website: jubileeinspire.com</Text>

              <View style={styles.termsFooterSpacer} />
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal
        visible={showPrivacyPolicy}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPrivacyPolicy(false)}
      >
        <View style={styles.termsModalOverlay}>
          <View style={styles.termsModalContainer}>
            {/* Header with close button */}
            <View style={styles.termsModalHeader}>
              <Text style={styles.termsModalTitle}>Privacy Policy</Text>
              <TouchableOpacity
                style={styles.termsCloseButton}
                onPress={() => setShowPrivacyPolicy(false)}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Scrollable content */}
            <ScrollView
              style={styles.termsContent}
              showsVerticalScrollIndicator={true}
              {...(Platform.OS === 'web' ? { className: 'themed-scrollbar' } as any : {})}
            >
              <Text style={styles.termsIntro}>
                JubileeInspire ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application ("App"). Please read this policy carefully. By using the App, you consent to the practices described herein.
              </Text>

              <Text style={styles.termsSectionTitle}>1. Information We Collect</Text>
              <Text style={styles.termsText}>We may collect and process the following types of information:</Text>

              <Text style={styles.termsSubtitle}>1.1 Information You Provide</Text>
              <Text style={styles.termsBullet}>• Account information (name, email address, profile picture)</Text>
              <Text style={styles.termsBullet}>• User-generated content (chat messages, notes, bookmarks)</Text>
              <Text style={styles.termsBullet}>• Feedback and correspondence (support requests, surveys)</Text>
              <Text style={styles.termsBullet}>• Payment information (processed securely by Apple; we do not store payment details)</Text>

              <Text style={styles.termsSubtitle}>1.2 Automatically Collected Information</Text>
              <Text style={styles.termsBullet}>• Device information (device type, operating system, unique device identifiers)</Text>
              <Text style={styles.termsBullet}>• Usage data (features accessed, time spent, interaction patterns)</Text>
              <Text style={styles.termsBullet}>• Log data (IP address, browser type, access times, error logs)</Text>
              <Text style={styles.termsBullet}>• Analytics data (app performance, crash reports)</Text>

              <Text style={styles.termsSectionTitle}>2. How We Use Your Information</Text>
              <Text style={styles.termsText}>We use the collected information for the following purposes:</Text>
              <Text style={styles.termsBullet}>• To provide, maintain, and improve the App</Text>
              <Text style={styles.termsBullet}>• To personalize your experience and deliver relevant content</Text>
              <Text style={styles.termsBullet}>• To process transactions and manage subscriptions</Text>
              <Text style={styles.termsBullet}>• To communicate with you about updates, features, and support</Text>
              <Text style={styles.termsBullet}>• To analyze usage patterns and optimize performance</Text>
              <Text style={styles.termsBullet}>• To detect, prevent, and address technical issues or fraud</Text>
              <Text style={styles.termsBullet}>• To comply with legal obligations</Text>

              <Text style={styles.termsSectionTitle}>3. Data Sharing and Disclosure</Text>
              <Text style={styles.termsText}>We do not sell your personal information. We may share your information in the following circumstances:</Text>

              <Text style={styles.termsSubtitle}>3.1 Service Providers</Text>
              <Text style={styles.termsText}>
                We may share information with third-party vendors who assist us in operating the App (e.g., cloud hosting, analytics, customer support). These providers are contractually bound to protect your data.
              </Text>

              <Text style={styles.termsSubtitle}>3.2 Legal Requirements</Text>
              <Text style={styles.termsText}>
                We may disclose information if required by law, regulation, legal process, or governmental request, or to protect our rights, privacy, safety, or property.
              </Text>

              <Text style={styles.termsSubtitle}>3.3 Business Transfers</Text>
              <Text style={styles.termsText}>
                In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of the transaction.
              </Text>

              <Text style={styles.termsSectionTitle}>4. Data Storage and Security</Text>
              <Text style={styles.termsText}>
                We implement industry-standard security measures to protect your information, including encryption, secure servers, and access controls. However, no method of transmission over the Internet or electronic storage is 100% secure.
              </Text>
              <Text style={styles.termsText}>
                Your data is stored on secure servers located in the United States. By using the App, you consent to the transfer of your information to the United States.
              </Text>

              <Text style={styles.termsSectionTitle}>5. Data Retention</Text>
              <Text style={styles.termsText}>
                We retain your personal information for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. You may request deletion of your data at any time (see Section 7).
              </Text>

              <Text style={styles.termsSectionTitle}>6. Children's Privacy</Text>
              <Text style={styles.termsText}>
                The App is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected such information, we will take steps to delete it promptly.
              </Text>

              <Text style={styles.termsSectionTitle}>7. Your Rights and Choices</Text>
              <Text style={styles.termsText}>Depending on your jurisdiction, you may have the following rights:</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Access:</Text> Request a copy of your personal data</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Correction:</Text> Request correction of inaccurate data</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Deletion:</Text> Request deletion of your personal data</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Portability:</Text> Request transfer of your data in a portable format</Text>
              <Text style={styles.termsBullet}>• <Text style={styles.termsBold}>Opt-out:</Text> Opt out of marketing communications</Text>
              <Text style={styles.termsText}>
                To exercise these rights, please contact us at support@jubileeinspire.com.
              </Text>

              <Text style={styles.termsSectionTitle}>8. Cookies and Tracking Technologies</Text>
              <Text style={styles.termsText}>
                We may use cookies, pixels, and similar tracking technologies to collect usage data and improve your experience. You can manage cookie preferences through your device settings.
              </Text>

              <Text style={styles.termsSectionTitle}>9. Third-Party Links</Text>
              <Text style={styles.termsText}>
                The App may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies.
              </Text>

              <Text style={styles.termsSectionTitle}>10. Changes to This Privacy Policy</Text>
              <Text style={styles.termsText}>
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy in the App or sending you a notification. Your continued use of the App after such changes constitutes your acceptance of the updated policy.
              </Text>

              <Text style={styles.termsSectionTitle}>11. California Privacy Rights (CCPA)</Text>
              <Text style={styles.termsText}>
                If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA), including the right to know what personal information we collect, request deletion, and opt out of the sale of personal information (we do not sell personal information).
              </Text>

              <Text style={styles.termsSectionTitle}>12. International Users (GDPR)</Text>
              <Text style={styles.termsText}>
                If you are located in the European Economic Area (EEA), you have rights under the General Data Protection Regulation (GDPR), including access, rectification, erasure, restriction, portability, and objection. Our legal basis for processing includes consent, contractual necessity, and legitimate interests.
              </Text>

              <Text style={styles.termsSectionTitle}>13. Contact Us</Text>
              <Text style={styles.termsText}>
                If you have questions, concerns, or requests regarding this Privacy Policy, please contact us:
              </Text>
              <Text style={styles.termsContact}>JubileeInspire Privacy Team</Text>
              <Text style={styles.termsContact}>Email: privacy@jubileeinspire.com</Text>
              <Text style={styles.termsContact}>Website: jubileeinspire.com/privacy</Text>

              <View style={styles.termsFooterSpacer} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
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
    padding: spacing.md,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatarInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  profileInfo: {
    marginLeft: spacing.md,
  },
  profileFirstName: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  profileSubtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
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
  // Terms of Use Modal Styles
  termsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  termsModalContainer: {
    backgroundColor: colors.background,
    borderRadius: 16,
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 10,
      },
    }),
  },
  termsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  termsModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: colors.text,
  },
  termsCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  termsContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  termsIntro: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  termsSectionTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  termsSubtitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  termsBold: {
    fontWeight: '600',
    color: colors.text,
  },
  termsText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  termsBullet: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 22,
    marginLeft: spacing.md,
    marginBottom: 4,
  },
  termsContact: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
    lineHeight: 22,
  },
  termsFooterSpacer: {
    height: spacing.xl,
  },
});

export default SettingsScreen;
