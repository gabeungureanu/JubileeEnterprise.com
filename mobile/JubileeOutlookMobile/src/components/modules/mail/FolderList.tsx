import React from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { Badge } from '../../common/Badge';
import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing } from '../../../constants/spacing';
import type { MailFolder } from '../../../types';

interface FolderListProps {
  folders: MailFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (folder: MailFolder) => void;
}

const FOLDER_ICONS: Record<string, { name: string; color: string }> = {
  inbox: { name: 'inbox', color: Colors.folderInbox },
  sent: { name: 'send', color: Colors.folderSent },
  drafts: { name: 'drafts', color: Colors.folderDrafts },
  trash: { name: 'delete', color: Colors.folderTrash },
  junk: { name: 'report', color: Colors.folderJunk },
  archive: { name: 'archive', color: Colors.folderArchive },
  custom: { name: 'folder', color: Colors.folderCustom },
};

function FolderItem({
  folder,
  isSelected,
  onPress,
}: {
  folder: MailFolder;
  isSelected: boolean;
  onPress: () => void;
}) {
  const iconConfig = FOLDER_ICONS[folder.folderType] || FOLDER_ICONS.custom;

  return (
    <TouchableOpacity
      style={[styles.folderItem, isSelected && styles.folderSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Icon name={iconConfig.name as any} size={22} color={isSelected ? Colors.primary : iconConfig.color} />
      <Text
        style={[styles.folderName, isSelected && styles.folderNameSelected]}
        numberOfLines={1}
      >
        {folder.name}
      </Text>
      {folder.unreadCount > 0 && (
        <Badge count={folder.unreadCount} color={Colors.accent} size="small" />
      )}
    </TouchableOpacity>
  );
}

export function FolderList({ folders, selectedFolderId, onSelectFolder }: FolderListProps) {
  const systemFolders = folders.filter((f) => f.isSystem);
  const customFolders = folders.filter((f) => !f.isSystem);

  return (
    <View style={styles.container}>
      <FlatList
        data={systemFolders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FolderItem
            folder={item}
            isSelected={item.id === selectedFolderId}
            onPress={() => onSelectFolder(item)}
          />
        )}
        ListFooterComponent={
          customFolders.length > 0 ? (
            <View>
              <Text style={styles.sectionHeader}>Folders</Text>
              {customFolders.map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  isSelected={folder.id === selectedFolderId}
                  onPress={() => onSelectFolder(folder)}
                />
              ))}
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  folderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  folderSelected: {
    backgroundColor: Colors.surfaceHover,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  folderName: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
  folderNameSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  sectionHeader: {
    ...Typography.labelSmall,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    textTransform: 'uppercase',
  },
});
