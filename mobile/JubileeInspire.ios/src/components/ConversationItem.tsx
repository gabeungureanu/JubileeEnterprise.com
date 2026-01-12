/**
 * Jubilee Inspire - Conversation Item Component
 *
 * Displays a conversation in the sidebar list.
 */

import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../types';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onPress: () => void;
  onDelete: () => void;
}

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  onPress,
  onDelete,
}) => {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuButtonRef = useRef<TouchableOpacity>(null);

  const handleDelete = () => {
    if (Platform.OS === 'web') {
      setShowDeleteConfirm(true);
    } else {
      Alert.alert(
        'Delete Conversation',
        'Are you sure you want to delete this conversation?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: onDelete },
        ]
      );
    }
  };

  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    onDelete();
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const handleOptionPress = (option: string) => {
    setShowOptionsMenu(false);

    switch (option) {
      case 'share':
        Alert.alert('Share', 'Share functionality coming soon!');
        break;
      case 'group':
        Alert.alert('Start a group chat', 'Group chat functionality coming soon!');
        break;
      case 'rename':
        Alert.alert('Rename', 'Rename functionality coming soon!');
        break;
      case 'pin':
        Alert.alert('Pin chat', 'Pin chat functionality coming soon!');
        break;
      case 'archive':
        Alert.alert('Archive', 'Archive functionality coming soon!');
        break;
      case 'delete':
        handleDelete();
        break;
    }
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <>
      <View style={styles.itemWrapper}>
        <TouchableOpacity
          style={[styles.container, isActive && styles.activeContainer]}
          onPress={onPress}
          activeOpacity={0.7}
          {...(Platform.OS === 'web' ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false)
          } as any : {})}
        >
          <View style={styles.iconContainer}>
            <Ionicons
              name="chatbubble-outline"
              size={18}
              color={isActive ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={styles.contentContainer}>
            <Text
              style={[styles.title, isActive && styles.activeTitle]}
              numberOfLines={1}
            >
              {conversation.title}
            </Text>
            {conversation.preview && (
              <Text style={styles.preview} numberOfLines={1}>
                {conversation.preview}
              </Text>
            )}
          </View>

          {(isHovered || Platform.OS !== 'web') && (
            <TouchableOpacity
              ref={menuButtonRef}
              style={styles.menuButton}
              onPress={(e: any) => {
                e.stopPropagation();
                if (Platform.OS === 'web' && e.target) {
                  const rect = e.target.getBoundingClientRect();
                  setMenuPosition({
                    top: rect.bottom + 10,
                    left: rect.left - 160,
                  });
                }
                setShowOptionsMenu(!showOptionsMenu);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

      </View>

      {/* Options Menu Modal */}
      <Modal
        visible={showOptionsMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOptionsMenu(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowOptionsMenu(false)}
        >
          <View style={[styles.menuContent, { position: 'absolute', top: menuPosition.top, left: menuPosition.left }]}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress('share')}
            >
              <Ionicons name="share-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Share</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress('group')}
            >
              <Ionicons name="people-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Start a group chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress('rename')}
            >
              <Ionicons name="create-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Rename</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress('pin')}
            >
              <Ionicons name="pin-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Pin chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress('archive')}
            >
              <Ionicons name="archive-outline" size={20} color={colors.text} />
              <Text style={styles.menuItemText}>Archive</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleOptionPress('delete')}
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
              <Text style={[styles.menuItemText, styles.deleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Confirmation Modal for Web */}
      {Platform.OS === 'web' && (
        <Modal
          visible={showDeleteConfirm}
          transparent={true}
          animationType="fade"
          onRequestClose={cancelDelete}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Ionicons name="trash-outline" size={24} color="#ef4444" />
                <Text style={styles.modalTitle}>Delete Conversation</Text>
              </View>

              <Text style={styles.modalMessage}>
                Are you sure you want to delete this conversation? This action cannot be undone.
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={cancelDelete}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.deleteButtonModal]}
                  onPress={confirmDelete}
                >
                  <Text style={styles.deleteButtonText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  itemWrapper: {
    position: 'relative',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 8,
    marginHorizontal: spacing.sm,
    marginVertical: 2,
  },
  activeContainer: {
    backgroundColor: `${colors.primary}15`,
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  contentContainer: {
    flex: 1,
  },
  title: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: '500',
  },
  activeTitle: {
    color: colors.primary,
    fontWeight: '600',
  },
  preview: {
    fontSize: typography.fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: spacing.xs,
    opacity: 0.6,
  },
  menuButton: {
    padding: spacing.xs,
    opacity: 0.6,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  menuContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: spacing.xs,
    minWidth: 200,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  menuItemText: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    fontWeight: '400',
  },
  deleteText: {
    color: '#ef4444',
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  modalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  modalMessage: {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.text,
  },
  deleteButtonModal: {
    backgroundColor: '#ef4444',
  },
  deleteButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default ConversationItem;

