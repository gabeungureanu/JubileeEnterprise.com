/**
 * SyncEmailScreen — Default auth landing screen matching web's sync panel.
 * Allows users to sync existing email accounts with JubileeOutlook.
 * Shows provider icons and email input to begin the sync flow.
 */
import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import AuthCard from '../../components/auth/AuthCard';

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const PROVIDERS = [
  { icon: 'mail' as const, label: 'Microsoft 365' },
  { text: 'M', label: 'Gmail' },
  { text: 'Y!', label: 'Yahoo' },
  { icon: 'cloud' as const, label: 'iCloud' },
  { icon: 'forward-to-inbox' as const, label: 'IMAP/POP' },
];

type Props = NativeStackScreenProps<AuthStackParamList, 'SyncEmail'>;

export default function SyncEmailScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const validateEmailField = useCallback(
    (value: string, field: string) => {
      if (errors[field] && value.trim() && EMAIL_REGEX.test(value.trim())) {
        clearError(field);
      }
    },
    [errors, clearError],
  );

  const handleContinue = () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrors({ syncEmail: 'Please enter your email address' });
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrors({ syncEmail: 'Please enter a valid email address' });
      return;
    }

    // Navigate to password screen with email
    navigation.navigate('SyncPassword', { email: trimmedEmail });
  };

  return (
    <AuthCard
      heading="Add all your email accounts"
      subtitle="Sync your existing email accounts with JubileeOutlook"
    >
      {/* Provider icons */}
      <View style={styles.providers}>
        {PROVIDERS.map((p, i) => (
          <View key={i} style={styles.providerBox}>
            {p.icon ? (
              <Icon name={p.icon} size={24} color={Colors.gold} />
            ) : (
              <Text style={styles.providerText}>{p.text}</Text>
            )}
          </View>
        ))}
      </View>

      {/* Support text */}
      <Text style={styles.supportText}>
        JubileeOutlook supports Microsoft 365, Gmail,{'\n'}Yahoo, iCloud, IMAP, and POP.
      </Text>
      <TouchableOpacity style={styles.learnMore}>
        <Text style={styles.learnMoreText}>Learn More</Text>
      </TouchableOpacity>

      {/* Form */}
      <View style={styles.form}>
        {/* Suggested accounts label */}
        <View style={styles.suggestedRow}>
          <Text style={styles.suggestedLabel}>Suggested accounts</Text>
          <Icon name="info-outline" size={14} color={Colors.textTertiary} />
        </View>

        {/* Email input */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, errors.syncEmail && styles.inputError]}
            placeholder="Enter your email"
            placeholderTextColor="#606060"
            value={email}
            onChangeText={v => {
              setEmail(v);
              validateEmailField(v, 'syncEmail');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
        </View>
        {errors.syncEmail && <Text style={styles.fieldError}>{errors.syncEmail}</Text>}

        {/* Create account link */}
        <View style={styles.createAccountRow}>
          <Text style={styles.createAccountText}>No account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
            <Text style={styles.goldLink}>Create a JubileeOutlook account</Text>
          </TouchableOpacity>
        </View>

        {/* Continue button */}
        <TouchableOpacity
          style={[styles.goldButton, !email.trim() && styles.goldButtonDisabled]}
          onPress={handleContinue}
          disabled={!email.trim()}
          activeOpacity={0.8}
        >
          <Text style={[styles.goldButtonText, !email.trim() && styles.goldButtonTextDisabled]}>
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  providers: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: Spacing.lg,
  },
  providerBox: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: BorderRadius.md,
    backgroundColor: '#1A1A00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerText: {
    fontSize: 20,
    fontWeight: '500',
    color: Colors.gold,
    lineHeight: 24,
  },
  supportText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 5,
  },
  learnMore: {
    marginBottom: Spacing.xxl,
  },
  learnMoreText: {
    fontSize: 13,
    color: Colors.gold,
  },
  form: {
    width: '100%',
  },
  suggestedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  suggestedLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  inputWrapper: {
    marginBottom: 6,
  },
  input: {
    width: '100%',
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: BorderRadius.md,
    color: Colors.white,
    fontSize: 14,
  },
  inputError: {
    borderColor: '#E53935',
  },
  fieldError: {
    fontSize: 11,
    color: '#E53935',
    marginLeft: 4,
    marginTop: 2,
    marginBottom: 8,
  },
  createAccountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  createAccountText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  goldLink: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '500',
  },
  goldButton: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.gold,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldButtonDisabled: {
    backgroundColor: Colors.goldDisabled,
  },
  goldButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.black,
  },
  goldButtonTextDisabled: {
    color: '#4D4D4D',
  },
});
