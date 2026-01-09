/**
 * Jubilee Inspire - Authentication Screen
 *
 * Sign In and Sign Up functionality with tab-based interface.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../config';
import { RootStackParamList, User, AuthTokens } from '../types';
import { useAuth } from '../contexts/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Auth'>;

type AuthMode = 'signin' | 'signup';

const AuthScreen: React.FC<Props> = ({ navigation }) => {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.CODEX_API_URL || 'http://localhost:3100/api';

      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
          rememberMe: true,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Sign in failed');
      }

      // Extract user and tokens from response (Codex API format)
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName || data.user.email.split('@')[0],
        avatarUrl: data.user.avatarUrl,
      };

      const tokens: AuthTokens = {
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
        expiresAt: Date.now() + (data.tokens.expiresIn * 1000), // Convert seconds to milliseconds
      };

      // Store authentication in context
      await signIn(user, tokens);

      console.log('✅ Sign in successful:', user.email);
      setSuccessMessage('Signed in successfully!');

      // Close the modal after a short delay
      setTimeout(() => {
        setSuccessMessage(null);
        navigation.goBack();
      }, 2000);
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      Alert.alert('Sign In Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !displayName.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const apiUrl = process.env.CODEX_API_URL || 'http://localhost:3100/api';

      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password: password,
          displayName: displayName.trim(),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Sign up failed');
      }

      // Extract user and tokens from response (Codex API format)
      const user: User = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName || displayName.trim(),
        avatarUrl: data.user.avatarUrl,
      };

      const tokens: AuthTokens = {
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
        expiresAt: Date.now() + (data.tokens.expiresIn * 1000),
      };

      // Store authentication in context
      await signIn(user, tokens);

      console.log('✅ Sign up successful:', user.email);
      setSuccessMessage('Account created successfully! Welcome to Jubilee Inspire!');

      // Close the modal after a short delay
      setTimeout(() => {
        setSuccessMessage(null);
        navigation.goBack();
      }, 2500);
    } catch (error: any) {
      console.error('❌ Sign up error:', error);
      Alert.alert('Sign Up Failed', error.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'signin') {
      handleSignIn();
    } else {
      handleSignUp();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Success Message Banner */}
          {successMessage && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={24} color="#10b981" />
              <Text style={styles.successText}>{successMessage}</Text>
            </View>
          )}

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Logo/Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>Jubilee Inspire</Text>
            <Text style={styles.subtitle}>
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </Text>
          </View>

          {/* Mode Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'signin' && styles.tabActive]}
              onPress={() => setMode('signin')}
            >
              <Text style={[styles.tabText, mode === 'signin' && styles.tabTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => setMode('signup')}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>
                Sign Up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {mode === 'signup' && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textSecondary}
                  autoCapitalize="words"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Enter your email"
                placeholderTextColor={colors.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={24}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {mode === 'signup' && (
              <Text style={styles.passwordHint}>
                Password must be at least 8 characters
              </Text>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.submitButtonText}>
                  {mode === 'signin' ? 'Sign In' : 'Sign Up'}
                </Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password */}
            {mode === 'signin' && (
              <TouchableOpacity style={styles.forgotPassword}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  backButton: {
    padding: spacing.sm,
  },
  titleContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['2xl'],
    paddingBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.fontSize.lg,
    color: colors.textSecondary,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#000000',
  },
  form: {
    paddingHorizontal: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.fontSize.base,
    color: colors.text,
  },
  eyeButton: {
    padding: spacing.md,
  },
  passwordHint: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
    marginBottom: spacing.lg,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: '#000000',
  },
  forgotPassword: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  forgotPasswordText: {
    fontSize: typography.fontSize.sm,
    color: colors.primary,
  },
  successBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#d1fae5',
    borderBottomWidth: 2,
    borderBottomColor: '#10b981',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      },
    }),
  },
  successText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: '#065f46',
    flex: 1,
  },
});

export default AuthScreen;
