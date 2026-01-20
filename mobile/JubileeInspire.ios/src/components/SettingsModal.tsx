/**
 * Jubilee Inspire - Settings Modal
 *
 * ChatGPT-style settings popup with sidebar navigation.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
  Alert,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography, APP_VERSION } from '../config';
import { useTheme, ThemeMode } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../services/storage';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onNavigateToAuth?: () => void;
  onClearHistory?: () => void;
}

type SettingsSection = 'general' | 'personalization' | 'data' | 'about' | 'account';

// Dropdown option type
interface DropdownOption {
  value: string;
  label: string;
}

// Responsive breakpoints
const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  onNavigateToAuth,
  onClearHistory,
}) => {
  const { colors, themeMode, setThemeMode, getThemeDisplayName } = useTheme();
  const { user, isAuthenticated, signOut } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [activeSection, setActiveSection] = useState<SettingsSection>('general');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Responsive helpers
  const isMobile = windowWidth < BREAKPOINTS.tablet;
  const isTablet = windowWidth >= BREAKPOINTS.tablet && windowWidth < BREAKPOINTS.laptop;
  const isLaptop = windowWidth >= BREAKPOINTS.laptop && windowWidth < BREAKPOINTS.desktop;
  const isDesktop = windowWidth >= BREAKPOINTS.desktop;

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [hoveredDropdownItem, setHoveredDropdownItem] = useState<string | null>(null);

  // Settings values
  const [bibleTranslation, setBibleTranslation] = useState('KJV');
  const [language, setLanguage] = useState('auto');
  const [defaultPersona, setDefaultPersona] = useState('jubilee-inspire');
  const [responseStyle, setResponseStyle] = useState('balanced');

  // Modal states for Privacy Policy and Terms of Use
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showTermsOfUse, setShowTermsOfUse] = useState(false);

  // Close all dropdowns when modal closes
  useEffect(() => {
    if (!visible) {
      setActiveDropdown(null);
      setHoveredDropdownItem(null);
    }
  }, [visible]);

  // Dropdown options
  const appearanceOptions: DropdownOption[] = [
    { value: 'system', label: 'System (Auto)' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ];

  const bibleTranslationOptions: DropdownOption[] = [
    { value: 'KJV', label: 'King James Version (KJV)' },
    { value: 'NIV', label: 'New International Version (NIV)' },
    { value: 'ESV', label: 'English Standard Version (ESV)' },
    { value: 'NASB', label: 'New American Standard Bible (NASB)' },
    { value: 'NLT', label: 'New Living Translation (NLT)' },
    { value: 'NKJV', label: 'New King James Version (NKJV)' },
  ];

  const languageOptions: DropdownOption[] = [
    { value: 'auto', label: 'Auto-detect' },
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Spanish' },
    { value: 'fr', label: 'French' },
    { value: 'de', label: 'German' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'zh', label: 'Chinese' },
  ];

  const personaOptions: DropdownOption[] = [
    { value: 'jubilee-inspire', label: 'JubileeInspire' },
  ];

  const responseStyleOptions: DropdownOption[] = [
    { value: 'concise', label: 'Concise' },
    { value: 'balanced', label: 'Balanced' },
    { value: 'detailed', label: 'Detailed' },
    { value: 'scholarly', label: 'Scholarly' },
  ];

  // Inject themed scrollbar CSS for web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined' && visible) {
      const styleId = 'settings-modal-scrollbar-style';
      let styleEl = document.getElementById(styleId);

      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }

      styleEl.textContent = `
        .settings-modal-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .settings-modal-scrollbar::-webkit-scrollbar-track {
          background: ${colors.surface};
          border-radius: 4px;
        }
        .settings-modal-scrollbar::-webkit-scrollbar-thumb {
          background: ${colors.border};
          border-radius: 4px;
        }
        .settings-modal-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${colors.textSecondary};
        }
      `;

      return () => {
        const el = document.getElementById(styleId);
        if (el) el.remove();
      };
    }
  }, [colors, visible]);

  const handleClearHistory = async () => {
    try {
      await storage.clearAll();
      onClose();
      if (onClearHistory) {
        onClearHistory();
      }
    } catch (error) {
      console.error('Error clearing conversations:', error);
      Alert.alert('Error', 'Failed to delete conversations. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      onClose();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleDropdown = (dropdownId: string) => {
    setActiveDropdown(activeDropdown === dropdownId ? null : dropdownId);
  };

  const getDisplayValue = (options: DropdownOption[], value: string): string => {
    const option = options.find(opt => opt.value === value);
    return option ? option.label : value;
  };

  const styles = createStyles(colors, windowWidth, windowHeight, isMobile);

  const sidebarItems: { id: SettingsSection; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
    { id: 'general', icon: 'settings-outline', label: 'General' },
    { id: 'personalization', icon: 'color-palette-outline', label: 'Personalization' },
    { id: 'data', icon: 'server-outline', label: 'Data controls' },
    { id: 'about', icon: 'information-circle-outline', label: 'About' },
    { id: 'account', icon: 'person-outline', label: 'Account' },
  ];

  const renderSidebar = () => (
    <View style={styles.sidebar}>
      {isMobile ? (
        // Mobile: Horizontal scrollable tabs
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sidebarMobileContent}
        >
          {sidebarItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.sidebarItemMobile,
                activeSection === item.id && styles.sidebarItemActive,
              ]}
              onPress={() => {
                setActiveSection(item.id);
                setActiveDropdown(null);
              }}
            >
              <Ionicons
                name={item.icon}
                size={20}
                color={activeSection === item.id ? colors.primary : colors.textSecondary}
              />
              <Text style={[
                styles.sidebarItemTextMobile,
                activeSection === item.id && styles.sidebarItemTextActiveMobile,
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        // Desktop/Tablet: Vertical sidebar
        sidebarItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.sidebarItem,
              activeSection === item.id && styles.sidebarItemActive,
              hoveredItem === item.id && styles.sidebarItemHovered,
            ]}
            onPress={() => {
              setActiveSection(item.id);
              setActiveDropdown(null);
            }}
            {...(Platform.OS === 'web' ? {
              onMouseEnter: () => setHoveredItem(item.id),
              onMouseLeave: () => setHoveredItem(null),
            } as any : {})}
          >
            <Ionicons
              name={item.icon}
              size={20}
              color={activeSection === item.id ? colors.text : colors.textSecondary}
            />
            <Text style={[
              styles.sidebarItemText,
              activeSection === item.id && styles.sidebarItemTextActive,
            ]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  // Close dropdown when clicking outside
  const handleContentPress = () => {
    if (activeDropdown) {
      setActiveDropdown(null);
    }
  };

  const renderDropdown = (
    id: string,
    label: string,
    value: string,
    options: DropdownOption[],
    onSelect: (value: string) => void
  ) => {
    const isActive = activeDropdown === id;

    return (
      <View style={[
        styles.dropdownContainer,
        // When this dropdown is active, give it a higher z-index
        isActive && { zIndex: 9999 }
      ]}>
        <TouchableOpacity
          style={styles.settingRow}
          onPress={() => toggleDropdown(id)}
          activeOpacity={0.7}
        >
          <Text style={styles.settingLabel}>{label}</Text>
          <View style={styles.settingValueContainer}>
            <Text style={styles.settingValue}>{getDisplayValue(options, value)}</Text>
            <Ionicons
              name={isActive ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.textSecondary}
            />
          </View>
        </TouchableOpacity>

        {isActive && (
          <View style={styles.dropdownListWrapper}>
            <View style={styles.dropdownList}>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.dropdownItem,
                    value === option.value && styles.dropdownItemSelected,
                    hoveredDropdownItem === `${id}-${option.value}` && styles.dropdownItemHovered,
                  ]}
                  onPress={() => {
                    onSelect(option.value);
                    setActiveDropdown(null);
                  }}
                  {...(Platform.OS === 'web' ? {
                    onMouseEnter: () => setHoveredDropdownItem(`${id}-${option.value}`),
                    onMouseLeave: () => setHoveredDropdownItem(null),
                  } as any : {})}
                >
                  <Text style={[
                    styles.dropdownItemText,
                    value === option.value && styles.dropdownItemTextSelected,
                  ]}>
                    {option.label}
                  </Text>
                  {value === option.value && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderSettingRow = (
    label: string,
    value: string,
    onPress?: () => void,
    hasDropdown: boolean = true
  ) => (
    <TouchableOpacity
      style={styles.settingRow}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingValueContainer}>
        <Text style={styles.settingValue}>{value}</Text>
        {hasDropdown && <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />}
      </View>
    </TouchableOpacity>
  );

  const renderGeneralContent = () => (
    <Pressable style={styles.contentPressable} onPress={handleContentPress}>
      <ScrollView
        style={styles.contentScroll}
        showsVerticalScrollIndicator={true}
        {...(Platform.OS === 'web' ? { className: 'settings-modal-scrollbar' } as any : {})}
      >
        <Text style={styles.contentTitle}>General</Text>

        {renderDropdown(
          'appearance',
          'Appearance',
          themeMode,
          appearanceOptions,
          (value) => setThemeMode(value as ThemeMode)
        )}

        {renderDropdown(
          'bibleTranslation',
          'Bible Translation',
          bibleTranslation,
          bibleTranslationOptions,
          setBibleTranslation
        )}

        {renderDropdown(
          'language',
          'Language',
          language,
          languageOptions,
          setLanguage
        )}
      </ScrollView>
    </Pressable>
  );

  const renderPersonalizationContent = () => (
    <Pressable style={styles.contentPressable} onPress={handleContentPress}>
      <ScrollView
        style={styles.contentScroll}
        showsVerticalScrollIndicator={true}
        {...(Platform.OS === 'web' ? { className: 'settings-modal-scrollbar' } as any : {})}
      >
        <Text style={styles.contentTitle}>Personalization</Text>

        {renderDropdown(
          'defaultPersona',
          'Default Persona',
          defaultPersona,
          personaOptions,
          setDefaultPersona
        )}

        {renderDropdown(
          'responseStyle',
          'Response Style',
          responseStyle,
          responseStyleOptions,
          setResponseStyle
        )}
      </ScrollView>
    </Pressable>
  );

  const renderDataContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={true}
      {...(Platform.OS === 'web' ? { className: 'settings-modal-scrollbar' } as any : {})}
    >
      <Text style={styles.contentTitle}>Data controls</Text>

      <TouchableOpacity
        style={styles.dangerButton}
        onPress={handleClearHistory}
      >
        <Ionicons name="trash-outline" size={20} color={colors.error} />
        <Text style={styles.dangerButtonText}>Clear all conversations</Text>
      </TouchableOpacity>

      <Text style={styles.settingDescription}>
        This will permanently delete all your chat history. This action cannot be undone.
      </Text>
    </ScrollView>
  );

  const renderAboutContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={true}
      {...(Platform.OS === 'web' ? { className: 'settings-modal-scrollbar' } as any : {})}
    >
      <Text style={styles.contentTitle}>About</Text>

      {renderSettingRow('Version', APP_VERSION || '1.0.0', undefined, false)}

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => setShowPrivacyPolicy(true)}
      >
        <Text style={styles.linkButtonText}>Privacy Policy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.linkButton}
        onPress={() => setShowTermsOfUse(true)}
      >
        <Text style={styles.linkButtonText}>Terms of Use</Text>
      </TouchableOpacity>

      <Text style={styles.copyright}>
        Copyright © 2026 JubileeInspire.com{'\n'}All Rights Reserved.
      </Text>
    </ScrollView>
  );

  const renderAccountContent = () => (
    <ScrollView
      style={styles.contentScroll}
      showsVerticalScrollIndicator={true}
      {...(Platform.OS === 'web' ? { className: 'settings-modal-scrollbar' } as any : {})}
    >
      <Text style={styles.contentTitle}>Account</Text>

      {isAuthenticated && user ? (
        <>
          {renderSettingRow('Email', user.email || 'Not set', undefined, false)}
          {renderSettingRow('Display Name', user.displayName || 'Not set', undefined, false)}
          {renderSettingRow('Subscription', 'Premium', undefined, false)}

          <TouchableOpacity
            style={[styles.dangerButton, { marginTop: spacing.xl }]}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={styles.dangerButtonText}>Sign out</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.settingDescription}>
            Sign in to sync your conversations across devices and unlock premium features.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              onClose();
              if (onNavigateToAuth) {
                onNavigateToAuth();
              }
            }}
          >
            <Ionicons name="log-in-outline" size={20} color="#ffffff" />
            <Text style={styles.primaryButtonText}>Sign in</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'general':
        return renderGeneralContent();
      case 'personalization':
        return renderPersonalizationContent();
      case 'data':
        return renderDataContent();
      case 'about':
        return renderAboutContent();
      case 'account':
        return renderAccountContent();
      default:
        return renderGeneralContent();
    }
  };

  const renderPrivacyPolicyModal = () => (
    <Modal
      visible={showPrivacyPolicy}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowPrivacyPolicy(false)}
    >
      <View style={styles.termsModalOverlay}>
        <View style={styles.termsModalContainer}>
          <View style={styles.termsModalHeader}>
            <Text style={styles.termsModalTitle}>Privacy Policy</Text>
            <TouchableOpacity
              style={styles.termsCloseButton}
              onPress={() => setShowPrivacyPolicy(false)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.termsContent}
            showsVerticalScrollIndicator={true}
            {...(Platform.OS === 'web' ? { className: 'settings-modal-scrollbar' } as any : {})}
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
  );

  const renderTermsOfUseModal = () => (
    <Modal
      visible={showTermsOfUse}
      animationType="slide"
      transparent={true}
      onRequestClose={() => setShowTermsOfUse(false)}
    >
      <View style={styles.termsModalOverlay}>
        <View style={styles.termsModalContainer}>
          <View style={styles.termsModalHeader}>
            <Text style={styles.termsModalTitle}>Terms of Use (EULA)</Text>
            <TouchableOpacity
              style={styles.termsCloseButton}
              onPress={() => setShowTermsOfUse(false)}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.termsContent}
            showsVerticalScrollIndicator={true}
            {...(Platform.OS === 'web' ? { className: 'settings-modal-scrollbar' } as any : {})}
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
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* Modal content */}
          <View style={styles.modalContent}>
            {/* Sidebar */}
            {renderSidebar()}

            {/* Main content area */}
            <View style={styles.mainContent}>
              {renderContent()}
            </View>
          </View>
        </Pressable>
      </Pressable>

      {/* Privacy Policy Modal */}
      {renderPrivacyPolicyModal()}

      {/* Terms of Use Modal */}
      {renderTermsOfUseModal()}
    </Modal>
  );
};

const createStyles = (colors: any, windowWidth: number, windowHeight: number, isMobile: boolean) => {
  // Calculate responsive dimensions
  const modalWidth = isMobile ? windowWidth - 32 : Math.min(700, windowWidth - 64);
  const modalHeight = isMobile ? windowHeight - 48 : Math.min(windowHeight * 0.9, 600);
  const sidebarWidth = isMobile ? '100%' : 200;

  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: isMobile ? 'flex-end' : 'center',
      alignItems: 'center',
      padding: isMobile ? 0 : spacing.lg,
    },
    container: {
      backgroundColor: colors.surface,
      borderRadius: isMobile ? 16 : 16,
      borderBottomLeftRadius: isMobile ? 0 : 16,
      borderBottomRightRadius: isMobile ? 0 : 16,
      width: isMobile ? '100%' : modalWidth,
      maxWidth: isMobile ? '100%' : 700,
      height: isMobile ? modalHeight : 'auto',
      maxHeight: isMobile ? '95%' : '85%',
      minHeight: isMobile ? 400 : 450,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      borderBottomWidth: isMobile ? 0 : 1,
      ...Platform.select({
        web: {
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        },
        default: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.4,
          shadowRadius: 16,
          elevation: 10,
        },
      }),
    },
    closeButton: {
      position: 'absolute',
      top: spacing.md,
      right: isMobile ? spacing.md : 'auto',
      left: isMobile ? 'auto' : spacing.md,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 8,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isMobile ? colors.background : 'transparent',
    },
    modalContent: {
      flex: 1,
      flexDirection: isMobile ? 'column' : 'row',
    },
    sidebar: isMobile ? {
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
    } : {
      width: sidebarWidth,
      backgroundColor: colors.background,
      paddingTop: spacing.xl + spacing.lg,
      paddingHorizontal: spacing.sm,
      borderRightWidth: 1,
      borderRightColor: colors.border,
    },
    sidebarMobileContent: {
      paddingHorizontal: spacing.md,
      gap: spacing.xs,
    },
    sidebarItemMobile: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: 8,
      minWidth: 70,
    },
    sidebarItemTextMobile: {
      fontSize: 11,
      color: colors.textSecondary,
      marginTop: 4,
      textAlign: 'center',
    },
    sidebarItemTextActiveMobile: {
      color: colors.primary,
      fontWeight: '600',
    },
    sidebarItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      borderRadius: 8,
      marginBottom: 2,
      gap: spacing.sm,
    },
    sidebarItemActive: {
      backgroundColor: colors.surface,
    },
    sidebarItemHovered: {
      backgroundColor: colors.menuItemHover,
    },
    sidebarItemText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    sidebarItemTextActive: {
      color: colors.text,
      fontWeight: '500',
    },
    mainContent: {
      flex: 1,
      paddingTop: isMobile ? spacing.md : spacing.xl,
      paddingHorizontal: isMobile ? spacing.md : spacing.xl,
      paddingRight: isMobile ? spacing.md : 32,
      paddingBottom: isMobile ? spacing.lg : spacing.md,
      overflow: 'visible',
    },
    contentScroll: {
      flex: 1,
      overflow: 'visible',
    },
  contentTitle: {
    fontSize: isMobile ? 18 : 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: isMobile ? spacing.md : spacing.xl,
  },
  contentPressable: {
    flex: 1,
  },
  dropdownContainer: {
    marginBottom: spacing.xs,
    position: 'relative',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexWrap: isMobile ? 'wrap' : 'nowrap',
    gap: isMobile ? spacing.xs : 0,
  },
  settingLabel: {
    fontSize: isMobile ? 13 : 14,
    color: colors.text,
    flex: isMobile ? 0 : 1,
    minWidth: isMobile ? '100%' : 'auto',
  },
  settingValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: isMobile ? 1 : 0,
    flexShrink: 0,
    justifyContent: isMobile ? 'space-between' : 'flex-end',
    width: isMobile ? '100%' : 'auto',
  },
  settingValue: {
    fontSize: isMobile ? 13 : 14,
    color: colors.textSecondary,
    flexShrink: 0,
    ...Platform.select({
      web: {
        whiteSpace: 'nowrap',
      } as any,
      default: {},
    }),
  },
  dropdownListWrapper: {
    position: isMobile ? 'relative' : 'absolute',
    top: isMobile ? 0 : '100%',
    right: isMobile ? 0 : 0,
    left: isMobile ? 0 : 'auto',
    marginTop: spacing.xs,
    marginRight: 0,
    zIndex: 1000,
  },
  dropdownList: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    minWidth: isMobile ? '100%' : 250,
    maxWidth: isMobile ? '100%' : 'auto',
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    }),
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: colors.surface,
  },
  dropdownItemHovered: {
    backgroundColor: colors.menuItemHover,
  },
  dropdownItemText: {
    fontSize: 14,
    color: colors.text,
  },
  dropdownItemTextSelected: {
    color: colors.primary,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    lineHeight: 20,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  dangerButtonText: {
    fontSize: 14,
    color: colors.error,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 8,
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  linkButton: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  linkButtonText: {
    fontSize: 14,
    color: colors.primary,
  },
  copyright: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xl,
    textAlign: 'center',
    lineHeight: 18,
  },
  // Terms/Privacy Modal Styles
  termsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: isMobile ? 'flex-end' : 'center',
    alignItems: 'center',
    padding: isMobile ? 0 : spacing.lg,
  },
  termsModalContainer: {
    backgroundColor: colors.background,
    borderRadius: isMobile ? 16 : 16,
    borderBottomLeftRadius: isMobile ? 0 : 16,
    borderBottomRightRadius: isMobile ? 0 : 16,
    width: '100%',
    maxWidth: isMobile ? '100%' : 600,
    maxHeight: isMobile ? '95%' : '90%',
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
};

export default SettingsModal;
