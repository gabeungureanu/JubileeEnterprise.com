/**
 * ForgotPasswordScreen — Password reset form matching web frontend's forgot panel.
 * Sends reset link via authService, shows success message, auto-navigates back.
 */
import React, { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { authService } from '../../services/auth/authService';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius } from '../../constants/spacing';
import AuthCard from '../../components/auth/AuthCard';

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>;

export default function ForgotPasswordScreen({ navigation, route }: Props) {
  const [email, setEmail] = useState(route.params?.email || '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

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

  const handleForgotPassword = async () => {
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setErrors({ email: 'Please enter your email address' });
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    setLoading(true);
    setLoadingText('Sending reset link...');
    setErrors({});

    try {
      await authService.forgotPassword(trimmedEmail);
      setLoading(false);
      setLoadingText('');
      setSuccessMessage(
        'If an account exists with this email, you will receive password reset instructions shortly.',
      );
      // Auto-navigate back to Sign In after 3 seconds
      setTimeout(() => navigation.navigate('SignIn'), 3000);
    } catch {
      setLoading(false);
      setLoadingText('');
      setErrors({ email: 'An error occurred. Please try again.' });
    }
  };

  return (
    <AuthCard subtitle="Reset your password">
      {/* Form */}
      <View style={styles.form}>
        {/* Description */}
        <Text style={styles.description}>
          Enter your email address and we'll send you a link to reset your password.
        </Text>

        {/* Success message */}
        {successMessage && (
          <View style={styles.successBanner}>
            <Text style={styles.successBannerText}>{successMessage}</Text>
          </View>
        )}

        {/* Email */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, errors.email && styles.inputError]}
            placeholder="Email"
            placeholderTextColor="#606060"
            value={email}
            onChangeText={v => {
              setEmail(v);
              validateEmailField(v, 'email');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            editable={!loading}
          />
        </View>
        {errors.email && <Text style={styles.fieldError}>{errors.email}</Text>}

        {/* Send Reset Link button */}
        <TouchableOpacity
          style={[styles.goldButton, loading && styles.goldButtonDisabled]}
          onPress={handleForgotPassword}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.black} />
          ) : (
            <Text style={styles.goldButtonText}>Send Reset Link</Text>
          )}
        </TouchableOpacity>

        {/* Loading text */}
        {loading && <Text style={styles.loadingText}>{loadingText}</Text>}

        {/* Back link */}
        <View style={styles.backLinks}>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.goldLink}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  form: {
    width: '100%',
  },
  description: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xxl,
  },
  successBanner: {
    width: '100%',
    backgroundColor: 'rgba(16, 124, 16, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 124, 16, 0.25)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  successBannerText: {
    fontSize: 13,
    color: Colors.success,
    textAlign: 'center',
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
  goldButton: {
    width: '100%',
    height: 48,
    backgroundColor: Colors.gold,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  goldButtonDisabled: {
    backgroundColor: Colors.goldDisabled,
  },
  goldButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.black,
  },
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  backLinks: {
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  goldLink: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '500',
  },
});
