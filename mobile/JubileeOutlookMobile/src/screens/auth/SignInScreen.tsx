/**
 * SignInScreen — Sign In form matching web frontend's signin panel.
 * Fields: Email, Password with visibility toggle.
 * Features: Remember me, forgot password link, per-field validation.
 */
import React, { useState, useCallback, useEffect } from 'react';
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
import { storage } from '../../utils/storage';
import { StorageKeys } from '../../constants';
import { Colors } from '../../constants/colors';
import { Spacing, BorderRadius, HitSlop } from '../../constants/spacing';
import AuthCard from '../../components/auth/AuthCard';
import GoldCheckbox from '../../components/auth/GoldCheckbox';

const EMAIL_REGEX = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

type Props = NativeStackScreenProps<AuthStackParamList, 'SignIn'>;

export default function SignInScreen({ navigation }: Props) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');

  // Pre-fill remembered email on mount
  useEffect(() => {
    (async () => {
      const savedEmail = await storage.get(StorageKeys.REMEMBER_EMAIL);
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    })();
  }, []);

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
    (value: string, field: string) => {
      if (errors[field] && value.trim()) {
        clearError(field);
      }
    },
    [errors, clearError],
  );

  // --- Validation ---

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Submit ---

  const handleSignIn = async () => {
    if (!validate()) return;

    setLoading(true);
    setLoadingText('Signing in...');

    const result = await login(email.trim(), password, rememberMe);

    if (!result.success) {
      setLoading(false);
      setLoadingText('');
      setErrors({ general: result.error || 'Sign in failed. Please try again.' });
    }
  };

  return (
    <AuthCard subtitle="Sign in to sync your email across devices">
      {/* Sign Up nav link */}
      <View style={styles.navLink}>
        <Text style={styles.navLinkText}>Don't have an account? </Text>
        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={styles.goldLink}>Sign Up.</Text>
        </TouchableOpacity>
      </View>

      {/* General error */}
      {errors.general && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{errors.general}</Text>
        </View>
      )}

      {/* Form */}
      <View style={styles.form}>
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
              validateRequiredField(v, 'password');
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
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

        {/* Options row: Remember Me + Forgot Password */}
        <View style={styles.optionsRow}>
          <GoldCheckbox
            checked={rememberMe}
            onToggle={setRememberMe}
            label="Keep me signed in"
          />
          <TouchableOpacity
            onPress={() =>
              navigation.navigate('ForgotPassword', { email: email.trim() || undefined })
            }
          >
            <Text style={styles.goldLink}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Sign In button */}
        <TouchableOpacity
          style={[styles.goldButton, loading && styles.goldButtonDisabled]}
          onPress={handleSignIn}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator size="small" color={Colors.black} />
          ) : (
            <Text style={styles.goldButtonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Loading text */}
        {loading && <Text style={styles.loadingText}>{loadingText}</Text>}
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  navLink: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  navLinkText: {
    fontSize: 13,
    color: Colors.textTertiary,
  },
  goldLink: {
    fontSize: 13,
    color: Colors.gold,
    fontWeight: '500',
  },
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
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
});
