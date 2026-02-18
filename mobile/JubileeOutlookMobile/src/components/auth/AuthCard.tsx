/**
 * AuthCard — Shared auth screen layout wrapper.
 * Renders avatar, branding/heading, subtitle, children (form), and footer.
 * Matches the web frontend's signin__panel + signin__card visual design.
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { SafeScreen } from '../layout/SafeScreen';

interface AuthCardProps {
  /** Custom heading text. When omitted, shows the "Jubilee Outlook" brand heading. */
  heading?: string;
  /** Avatar icon name (MaterialIcons). Default: "person" */
  avatarIcon?: React.ComponentProps<typeof Icon>['name'];
  subtitle: string;
  children: React.ReactNode;
}

const AuthCard: React.FC<AuthCardProps> = ({
  heading,
  avatarIcon = 'person',
  subtitle,
  children,
}) => {
  return (
    <SafeScreen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar */}
          <View style={styles.avatar}>
            <Icon name={avatarIcon} size={44} color={Colors.textTertiary} />
          </View>

          {/* Heading */}
          {heading ? (
            <Text style={styles.heading}>{heading}</Text>
          ) : (
            <Text style={styles.brandHeading}>
              <Text style={styles.brandJubilee}>Jubilee</Text>
              <Text style={styles.brandOutlook}> Outlook</Text>
            </Text>
          )}

          {/* Subtitle */}
          <Text style={styles.subtitle}>{subtitle}</Text>

          {/* Form content */}
          {children}

          {/* Footer */}
          <Text style={styles.footer}>&copy; 2026 Jubilee Software, Inc.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxxxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.gold,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  heading: {
    fontSize: 22,
    fontWeight: '500',
    color: Colors.white,
    marginBottom: Spacing.sm,
    textAlign: 'center',
    lineHeight: 28,
  },
  brandHeading: {
    fontSize: 30,
    lineHeight: 38,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  brandJubilee: {
    fontWeight: '500',
    color: Colors.white,
  },
  brandOutlook: {
    fontWeight: '300',
    color: Colors.gold,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  footer: {
    ...Typography.caption,
    color: '#404040',
    marginTop: Spacing.xxxl,
    textAlign: 'center',
  },
});

export default AuthCard;
