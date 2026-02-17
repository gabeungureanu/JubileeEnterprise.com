/**
 * SyncPasswordScreen — Password entry + IMAP sync flow matching web's sync-password panel.
 * Detects provider on mount, connects to mail server, syncs emails,
 * then transitions to authenticated state via AuthContext's sync-only mode.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../types/navigation';
import { emailSyncService, ProviderInfo } from '../../services/mail/emailSyncService';
import { tokenStore } from '../../services/apiClient';
import { storage } from '../../utils/storage';
import { StorageKeys } from '../../constants';
import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius, HitSlop } from '../../constants/spacing';
import AuthCard from '../../components/auth/AuthCard';

type Props = NativeStackScreenProps<AuthStackParamList, 'SyncPassword'>;

// Simple hash function for generating deterministic userId from email (mobile adaptation)
function generateSyncUserId(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    const char = email.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(32, '0');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export default function SyncPasswordScreen({ navigation, route }: Props) {
  const syncEmail = route.params.email;

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [syncStatusText, setSyncStatusText] = useState('');
  const [detectingProvider, setDetectingProvider] = useState(true);

  // Animated progress bar
  const progressAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading && syncStatusText) {
      // Animate progress bar back and forth
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(progressAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
          Animated.timing(progressAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: false,
          }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    }
  }, [loading, syncStatusText, progressAnim]);

  // Detect provider on mount
  useEffect(() => {
    const detect = async () => {
      try {
        const provider = await emailSyncService.detectProvider(syncEmail);
        setProviderInfo(provider);
      } catch {
        // Fallback to generic provider
        setProviderInfo({
          type: 'generic',
          displayName: 'Email',
          isAppPassword: false,
          helpText: 'Enter the password for your email account.',
          imapHost: '',
          imapPort: 993,
          smtpHost: '',
          smtpPort: 587,
        });
      } finally {
        setDetectingProvider(false);
      }
    };
    detect();
  }, [syncEmail]);

  const clearError = useCallback((field: string) => {
    setErrors(prev => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    if (!password) {
      setErrors({ syncPassword: 'Password is required' });
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Step 1: Get or generate userId
      setSyncStatusText('Connecting to mail server...');
      setLoadingText('Connecting...');

      let userId = tokenStore.getUserId();
      if (!userId) {
        userId = generateSyncUserId(syncEmail);
        await tokenStore.setUserId(userId);
      }

      // Step 2: Connect
      setSyncStatusText('Testing IMAP connection...');
      setLoadingText('Testing connection...');

      const connectResult = await emailSyncService.connectAccount(syncEmail, password, userId);

      if (!connectResult.success) {
        setErrors({
          syncPassword: connectResult.error || 'Connection failed. Please check your credentials.',
        });
        setLoading(false);
        setSyncStatusText('');
        setLoadingText('');
        return;
      }

      // Step 3: Sync
      setSyncStatusText('Syncing emails...');
      setLoadingText('Syncing emails...');

      if (connectResult.account) {
        const syncResult = await emailSyncService.syncAccount(connectResult.account.id);
        if (syncResult.success) {
          setSyncStatusText(`Synced ${syncResult.totalSynced} messages!`);
          setLoadingText('Sync complete!');
        }
      }

      // Step 4: Success
      setSyncStatusText('Email account synced successfully!');
      setLoadingText('Preparing your mailbox...');

      // Brief delay for user to see success
      await new Promise(r => setTimeout(r, 1500));

      // Save sync email so AuthContext creates a sync-only session
      await storage.set(StorageKeys.SYNC_EMAIL, syncEmail);

      // Force a re-render of the auth state by reloading the app
      // The AuthContext bootstrap will detect sync-only mode and authenticate
      // We use a simple approach: navigate to a dummy screen or force re-init
      // For now, set the userId and trigger auth state change
      // The RootNavigator will pick up the sync-only state on next check

      // Trigger app reload by clearing and re-initializing
      await tokenStore.init();

      // Navigation will auto-switch to Main when AuthContext detects sync-only mode
      // Force a state refresh by navigating back to trigger re-evaluation
      navigation.reset({
        index: 0,
        routes: [{ name: 'SignIn' }],
      });
    } catch (err: any) {
      setErrors({ syncPassword: err.message || 'An error occurred during sync.' });
    } finally {
      setLoading(false);
      setLoadingText('');
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (detectingProvider) {
    return (
      <AuthCard avatarIcon="lock" subtitle={`Detecting provider for ${syncEmail}`}>
        <ActivityIndicator size="large" color={Colors.gold} />
        <Text style={styles.detectingText}>Detecting email provider...</Text>
      </AuthCard>
    );
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['10%', '90%'],
  });

  return (
    <AuthCard
      avatarIcon="lock"
      heading={providerInfo?.isAppPassword ? 'App Password Required' : 'Authentication Required'}
      subtitle={`Enter password for: ${syncEmail}`}
    >
      {/* Provider badge */}
      {providerInfo && (
        <View style={styles.providerBadge}>
          <Text style={styles.providerBadgeText}>
            Provider: {providerInfo.displayName}
          </Text>
        </View>
      )}

      {/* Form */}
      <View style={styles.form}>
        {/* Error */}
        {errors.syncPassword && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errors.syncPassword}</Text>
          </View>
        )}

        {/* Password label */}
        <Text style={styles.passwordLabel}>
          {providerInfo?.isAppPassword ? 'App Password:' : 'Password:'}
        </Text>

        {/* Password input */}
        <View style={[styles.inputWrapper, styles.passwordWrapper]}>
          <TextInput
            style={[styles.input, styles.passwordInput, errors.syncPassword && styles.inputError]}
            placeholder={
              providerInfo?.isAppPassword ? 'Enter app password' : 'Enter your password'
            }
            placeholderTextColor="#606060"
            value={password}
            onChangeText={v => {
              setPassword(v);
              if (errors.syncPassword) clearError('syncPassword');
            }}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            editable={!loading}
            autoFocus
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

        {/* Help text */}
        {providerInfo?.helpText && (
          <View style={styles.helpTextBox}>
            {providerInfo.helpText.split('\n').map((line, i) => (
              <Text key={i} style={[styles.helpText, i === 0 && styles.helpTextFirst]}>
                {line}
              </Text>
            ))}
          </View>
        )}

        {/* Sync progress */}
        {loading && syncStatusText && (
          <View style={styles.syncProgress}>
            <View style={styles.syncBar}>
              <Animated.View style={[styles.syncBarFill, { width: progressWidth }]} />
            </View>
            <Text style={styles.syncStatus}>{syncStatusText}</Text>
          </View>
        )}

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.cancelButton, loading && styles.cancelButtonDisabled]}
            onPress={handleCancel}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.goldButton,
              (loading || !password) && styles.goldButtonDisabled,
            ]}
            onPress={handleConfirm}
            disabled={loading || !password}
            activeOpacity={0.8}
          >
            {loading ? (
              <Text style={styles.goldButtonText}>{loadingText}</Text>
            ) : (
              <Text style={styles.goldButtonText}>Confirm</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </AuthCard>
  );
}

const styles = StyleSheet.create({
  detectingText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
  },
  providerBadge: {
    paddingVertical: 4,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    marginBottom: Spacing.xl,
  },
  providerBadgeText: {
    fontSize: 13,
    color: Colors.gold,
  },
  form: {
    width: '100%',
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
  passwordLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
    marginBottom: Spacing.sm,
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
  helpTextBox: {
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: 12,
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  helpText: {
    fontSize: 12,
    color: Colors.textTertiary,
    lineHeight: 19,
  },
  helpTextFirst: {
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  syncProgress: {
    marginVertical: Spacing.lg,
    alignItems: 'center',
  },
  syncBar: {
    width: '100%',
    height: 3,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  syncBarFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  syncStatus: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: Spacing.xs,
  },
  cancelButton: {
    paddingHorizontal: 24,
    height: 48,
    backgroundColor: Colors.surfaceHover,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonDisabled: {
    opacity: 0.5,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  goldButton: {
    flex: 1,
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
});
