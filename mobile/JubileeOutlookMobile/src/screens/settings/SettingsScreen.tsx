/**
 * SettingsScreen — Grouped settings with reusable SettingsItem component.
 *
 * Sections: Account, Sync, Signatures, Rules, Templates, General, About.
 * Uses ScrollView for vertical layout. Calls useAuth().logout() for sign-out.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner, Avatar } from '../../components/common';
import { useAlert } from '../../hooks';
import { emailSyncService } from '../../services/mail/emailSyncService';
import { signatureService } from '../../services/mail/signatureService';
import { rulesService } from '../../services/mail/rulesService';
import { templateService } from '../../services/mail/templateService';
import { tokenStore } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import type { EmailSignature, EmailRule, EmailTemplate } from '../../types/mail';

// ────────────────────────────────────────────────────────────
// Reusable SettingsItem
// ────────────────────────────────────────────────────────────

interface SettingsItemProps {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  isDestructive?: boolean;
  rightElement?: React.ReactNode;
}

function SettingsItem({
  icon,
  label,
  value,
  onPress,
  isDestructive = false,
  rightElement,
}: SettingsItemProps) {
  const content = (
    <View style={settingsItemStyles.row}>
      <Icon
        name={icon as any}
        size={22}
        color={isDestructive ? Colors.error : Colors.textSecondary}
        style={settingsItemStyles.icon}
      />
      <View style={settingsItemStyles.labelContainer}>
        <Text
          style={[
            settingsItemStyles.label,
            isDestructive && settingsItemStyles.labelDestructive,
          ]}
        >
          {label}
        </Text>
        {!!value && <Text style={settingsItemStyles.value}>{value}</Text>}
      </View>
      {rightElement ||
        (onPress && (
          <Icon name="chevron-right" size={22} color={Colors.textTertiary} />
        ))}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const settingsItemStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    minHeight: 52,
  },
  icon: {
    marginRight: Spacing.md,
  },
  labelContainer: {
    flex: 1,
  },
  label: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  labelDestructive: {
    color: Colors.error,
  },
  value: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────

const APP_VERSION = '1.0.0';

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user, logout } = useAuth();
  const { alert, confirm, AlertComponent } = useAlert();

  const [accounts, setAccounts] = useState<{ id: string; email_address: string; provider_type: string; connection_status: string }[]>([]);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [autoSync, setAutoSync] = useState(true);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Load data ─────────────────────────────────────────────

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const userId = tokenStore.getUserId();
      const [accts, sigs, rls, tmpls] = await Promise.all([
        userId ? emailSyncService.getAccounts(userId) : Promise.resolve([]),
        signatureService.getAll(),
        rulesService.getAll(),
        templateService.getAll(),
      ]);

      setAccounts(accts);
      setSignatures(sigs);
      setRules(rls);
      setTemplates(tmpls);
    } catch (err: any) {
      setError(err?.message || 'Failed to load settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ── Actions ───────────────────────────────────────────────

  const handleManualSync = useCallback(async () => {
    if (accounts.length === 0) {
      alert('No Accounts', 'Connect an email account first', 'warning');
      return;
    }

    setIsSyncing(true);
    try {
      let totalSynced = 0;
      for (const acct of accounts) {
        const result = await emailSyncService.syncAccount(acct.id);
        totalSynced += result.totalSynced ?? 0;
      }
      alert('Sync Complete', `Synced ${totalSynced} messages`, 'success');
    } catch (err: any) {
      alert('Sync Error', err?.message || 'Failed to sync', 'error');
    } finally {
      setIsSyncing(false);
    }
  }, [accounts, alert]);

  const handleAddAccount = useCallback(() => {
    alert('Add Account', 'Account connection will be available in a future update', 'info');
  }, [alert]);

  const handleLogout = useCallback(() => {
    confirm(
      'Sign Out',
      'Are you sure you want to sign out?',
      async () => {
        try {
          await logout();
        } catch (err: any) {
          alert('Error', err?.message || 'Failed to sign out', 'error');
        }
      },
      { confirmText: 'Sign Out', destructive: true },
    );
  }, [logout, confirm, alert]);

  // ── Section header helper ─────────────────────────────────

  const renderSectionHeader = (title: string) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  // ── Main render ───────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Account ──────────────────────────────────────── */}
      {renderSectionHeader('Account')}
      {user && (
        <View style={styles.accountRow}>
          <Avatar name={user.displayName} size={44} />
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{user.displayName}</Text>
            <Text style={styles.accountEmail}>{user.email}</Text>
          </View>
        </View>
      )}
      {accounts.map((acct) => (
        <SettingsItem
          key={acct.id}
          icon="mail"
          label={acct.email_address}
          value={
            acct.connection_status === 'connected'
              ? 'Connected'
              : acct.connection_status === 'error'
                ? 'Connection Error'
                : 'Disconnected'
          }
        />
      ))}
      <SettingsItem
        icon="add"
        label="Add Account"
        onPress={handleAddAccount}
      />

      {/* ── Sync ─────────────────────────────────────────── */}
      {renderSectionHeader('Sync')}
      <SettingsItem
        icon="sync"
        label="Auto-sync"
        rightElement={
          <Switch
            value={autoSync}
            onValueChange={setAutoSync}
            trackColor={{ false: Colors.surfaceLight, true: Colors.primaryDark }}
            thumbColor={autoSync ? Colors.primary : Colors.textTertiary}
          />
        }
      />
      <SettingsItem
        icon="schedule"
        label="Sync Interval"
        value="Every 15 minutes"
      />
      <SettingsItem
        icon="refresh"
        label={isSyncing ? 'Syncing...' : 'Sync Now'}
        onPress={handleManualSync}
        rightElement={
          isSyncing ? (
            <LoadingSpinner size="small" />
          ) : undefined
        }
      />

      {/* ── Signatures ───────────────────────────────────── */}
      {renderSectionHeader('Signatures')}
      {signatures.length === 0 ? (
        <SettingsItem
          icon="edit"
          label="No signatures"
          value="Tap to create one"
          onPress={() => alert('Signatures', 'Signature editor coming soon', 'info')}
        />
      ) : (
        signatures.map((sig) => (
          <SettingsItem
            key={sig.id}
            icon={sig.isDefault ? 'star' : 'edit'}
            label={sig.name}
            value={sig.isDefault ? 'Default' : undefined}
            onPress={() => alert('Edit Signature', `Editing "${sig.name}" coming soon`, 'info')}
          />
        ))
      )}

      {/* ── Rules ────────────────────────────────────────── */}
      {renderSectionHeader('Rules')}
      {rules.length === 0 ? (
        <SettingsItem
          icon="rule"
          label="No rules"
          value="Tap to create one"
          onPress={() => alert('Rules', 'Rule editor coming soon', 'info')}
        />
      ) : (
        rules.map((rule) => (
          <SettingsItem
            key={rule.id}
            icon="rule"
            label={rule.name}
            value={rule.enabled ? 'Enabled' : 'Disabled'}
            onPress={() => alert('Edit Rule', `Editing "${rule.name}" coming soon`, 'info')}
          />
        ))
      )}

      {/* ── Templates ────────────────────────────────────── */}
      {renderSectionHeader('Templates')}
      {templates.length === 0 ? (
        <SettingsItem
          icon="article"
          label="No templates"
          value="Tap to create one"
          onPress={() => alert('Templates', 'Template editor coming soon', 'info')}
        />
      ) : (
        templates.map((tmpl) => (
          <SettingsItem
            key={tmpl.id}
            icon="article"
            label={tmpl.name}
            value={tmpl.subject}
            onPress={() => alert('Edit Template', `Editing "${tmpl.name}" coming soon`, 'info')}
          />
        ))
      )}

      {/* ── General ──────────────────────────────────────── */}
      {renderSectionHeader('General')}
      <SettingsItem
        icon="notifications"
        label="Notifications"
        rightElement={
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            trackColor={{ false: Colors.surfaceLight, true: Colors.primaryDark }}
            thumbColor={notificationsEnabled ? Colors.primary : Colors.textTertiary}
          />
        }
      />

      {/* ── About ────────────────────────────────────────── */}
      {renderSectionHeader('About')}
      <SettingsItem
        icon="info"
        label="App Version"
        value={APP_VERSION}
      />
      <SettingsItem
        icon="logout"
        label="Sign Out"
        onPress={handleLogout}
        isDestructive
      />

      {/* Error notice */}
      {!!error && (
        <View style={styles.errorBanner}>
          <Icon name="warning" size={18} color={Colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </ScrollView>
    {AlertComponent}
    </>
  );
};

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xxxxl,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Section headers
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.background,
  },
  sectionHeaderText: {
    ...Typography.label,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Account row
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  accountInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  accountName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  accountEmail: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: 'rgba(209, 52, 56, 0.15)',
    borderRadius: BorderRadius.md,
  },
  errorText: {
    ...Typography.bodySmall,
    color: Colors.error,
    marginLeft: Spacing.sm,
    flex: 1,
  },
});

export default SettingsScreen;
