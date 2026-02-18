/**
 * SidebarDrawer — Two-column sidebar for the Mail module.
 *
 * Left rail (top → bottom):
 *   Individual account avatars → Settings gear.
 * Right area: Account email (top), folder list (below).
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import { FolderList } from './FolderList';
import type { MailFolder } from '../../../types';
import type { MainTabParamList } from '../../../types/navigation';

// ---------- Constants ----------

/** Width of the narrow left icon rail. */
const RAIL_WIDTH = 56;

/** Size of the circular avatar in the rail. */
const RAIL_AVATAR_SIZE = 36;

// ---------- Types ----------

interface SidebarDrawerProps {
  /** Current user email address. */
  userEmail: string;
  /** User avatar URL (or undefined for fallback icon). */
  userAvatarUrl?: string;
  /** User display name. */
  userDisplayName?: string;
  /** Linked mail accounts loaded from the API. */
  accounts: { id: string; email: string }[];
  /** All mail folders. */
  allFolders: MailFolder[];
  /** Currently selected folder ID. */
  selectedFolderId: string | null;
  /** Callback when a folder is selected. */
  onSelectFolder: (folder: MailFolder) => void;
  /** Callback to close the drawer. */
  onClose: () => void;
}

// ---------- Sub-Components ----------

function AccountAvatar({
  email,
  size,
}: {
  email: string;
  size: number;
}) {
  const initial = email.charAt(0).toUpperCase();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.surfaceLight,
        borderWidth: 1.5,
        borderColor: Colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontSize: size * 0.4,
          fontWeight: '700',
          color: Colors.textSecondary,
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

// ---------- Main Component ----------

export function SidebarDrawer({
  userEmail,
  userAvatarUrl,
  userDisplayName,
  accounts,
  allFolders,
  selectedFolderId,
  onSelectFolder,
  onClose,
}: SidebarDrawerProps) {
  const insets = useSafeAreaInsets();
  const tabNav = useNavigation<NavigationProp<MainTabParamList>>();

  // Show the first account email, or fallback to user email
  const displayEmail = accounts.length > 0 ? accounts[0].email : userEmail;

  const handleSettings = () => {
    onClose();
    tabNav.navigate('SettingsTab');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* ---- Left Rail ---- */}
      <View style={styles.rail}>
        {/* Top: Account avatars */}
        <View style={styles.railTop}>
          {accounts.map((account) => (
            <TouchableOpacity
              key={account.id}
              style={styles.railAvatarWrap}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <AccountAvatar email={account.email} size={RAIL_AVATAR_SIZE} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom: Settings gear */}
        <TouchableOpacity
          style={styles.railIcon}
          onPress={handleSettings}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Icon name="settings" size={24} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ---- Divider ---- */}
      <View style={styles.divider} />

      {/* ---- Right Content ---- */}
      <View style={styles.content}>
        {/* Account email header */}
        <View style={styles.emailHeader}>
          <Text style={styles.emailText} numberOfLines={1}>
            {displayEmail}
          </Text>
        </View>

        {/* Folder list */}
        <FolderList
          folders={allFolders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      </View>
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
  },

  // Left rail — full height, space-between for top avatars + bottom settings
  rail: {
    width: RAIL_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.lg,
    paddingBottom: 0,
    backgroundColor: Colors.background,
  },
  railTop: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  railAvatarWrap: {
    paddingVertical: Spacing.xxs,
  },
  railIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
  },

  // Divider between rail and content
  divider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
  },

  // Right content area
  content: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  emailHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  emailText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
});
