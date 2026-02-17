/**
 * SignUpScreen — Registration form matching web frontend's signup panel.
 * Fields: Full Name, Email, Password, Confirm Password.
 * Features: Newsletter checkbox, per-field validation, real-time error clearing.
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
import { MaterialIcons as Icon } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { useAuth } from '../../context/AuthContext';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius, HitSlop } from '../../constants/spacing';
import AuthCard from '../../components/auth/AuthCard';
import GoldCheckbox from '../../components/auth/GoldCheckbox';

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Props = NativeStackScreenProps<AuthStackParamList, 'SignUp'>;

export default function SignUpScreen({ navigation }: Props) {
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // --- Validation helpers (match web exactly) ---

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

  const validateRequiredField = useCallback(
    (value: string, field: string, minLength?: number) => {
      if (errors[field]) {
        const trimmed = value.trim();
        if (trimmed && (!minLength || trimmed.length >= minLength)) {
          clearError(field);
        }
      }
    },
    [errors, clearError],
  );

  // --- Validation ---

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (fullName.trim().length < 2) {
      newErrors.fullName = 'Name must be at least 2 characters';
    }

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Submit ---

  const handleSignUp = async () => {
    if (!validate()) return;

    setLoading(true);
    setLoadingText('Creating account...');

    const result = await register(fullName.trim(), email.trim(), password, newsletter);

    if (!result.success) {
      setLoading(false);
      setLoadingText('');
      setErrors({ general: result.error || 'Registration failed. Please try again.' });
    }
  };

  return (
    <AuthCard subtitle="Create an account to get started">
      {/* General error */}
      {errors.general && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errors.general}</Text>
        </View>
      )}

      {/* Form */}
      <View style={styles.form}>
        {/* Full Name */}
        <View style={styles.inputWrapper}>
          <TextInput
            style={[styles.input, errors.fullName && styles.inputError]}
            placeholder="Full Name"
            placeholderTextColor="#606060"
            value={fullName}
            onChangeText={v => {
              setFullName(v);
              validateRequiredField(v, 'fullName', 2);
            }}
            autoCapitalize="words"
            autoComplete="name"
            editable={!loading}
          />
        </View>
        {errors.fullName && <Text style={styles.fieldError}>{errors.fullName}</Text>}

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

        {/* Password */}
        <View style={[styles.inputWrapper, styles.passwordWrapper]}>
          <TextInput
            style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
            placeholder="Password"
            placeholderTextColor="#606060"
            value={password}
            onChangeText={v => {
              setPassword(v);
              validateRequiredField(v, 'password', 6);
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={HitSlop}
          >
            <Icon
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={20}
              color="#606060"
            />
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.fieldError}>{errors.password}</Text>}

        {/* Confirm Password */}
        <View style={[styles.inputWrapper, styles.passwordWrapper]}>
          <TextInput
            style={[
              styles.input,
              styles.passwordInput,
              errors.confirmPassword && styles.inputError,
            ]}
            placeholder="Confirm Password"
            placeholderTextColor="#606060"
            value={confirmPassword}
            onChangeText={v => {
              setConfirmPassword(v);
              if (errors.confirmPassword && v === password) {
                clearError('confirmPassword');
              }
            }}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
            autoComplete="new-password"
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            hitSlop={HitSlop}
          >
            <Icon
              name={showConfirmPassword ? 'visibility-off' : 'visibility'}
              size={20}
              color="#606060"
            />
          </TouchableOpacity>
        </View>
        {errors.confirmPassword && (
          <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
        )}

        {/* Newsletter checkbox */}
        <View style={styles.newsletterRow}>
          <GoldCheckbox
            checked={newsletter}
            onToggle={setNewsletter}
            label="Subscribe to newsletter"
          />
        </View>

        {/* Sign Up button */}
        <TouchableOpacity
          style={[styles.goldButton, loading && styles.goldButtonDisabled]}
          onPress={handleSignUp}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.black} />
          ) : (
            <Text style={styles.goldButtonText}>Sign Up</Text>
          )}
        </TouchableOpacity>

        {/* Loading text */}
        {loading && <Text style={styles.loadingText}>{loadingText}</Text>}

        {/* Back links */}
        <View style={styles.backLinks}>
          <Text style={styles.backLinkText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SignIn')}>
            <Text style={styles.goldLink}>Sign In</Text>
          </TouchableOpacity>
          <Text style={styles.linkSeparator}> | </Text>
          <TouchableOpacity onPress={() => navigation.navigate('SyncEmail')}>
            <Text style={styles.goldLink}>Sync Existing</Text>
          </TouchableOpacity>
        </View>
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  errorBanner: {
    width: '100%',
    backgroundColor: 'rgba(229, 57, 53, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(229, 57, 53, 0.25)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  errorBannerText: {
    fontSize: 13,
    color: '#E53935',
    textAlign: 'center',
  },
  form: {
    width: '100%',
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
  passwordWrapper: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 32,
  },
  fieldError: {
    fontSize: 11,
    color: '#E53935',
    marginLeft: 4,
    marginTop: 2,
    marginBottom: 8,
  },
  newsletterRow: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xxl,
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
  loadingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  backLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  backLinkText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  linkSeparator: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  goldLink: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '500',
  },
});
