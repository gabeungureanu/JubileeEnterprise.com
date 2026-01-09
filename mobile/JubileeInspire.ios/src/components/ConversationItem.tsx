/**
 * Jubilee Inspire - Conversation Item Component
 *
 * Displays a conversation in the sidebar list.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../types';
import { colors, spacing, typography } from '../config';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
      <TouchableOpacity
        style={[styles.container, isActive && styles.activeContainer]}
        onPress={onPress}
        activeOpacity={0.7}
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

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textSecondary} />
        </TouchableOpacity>
      </TouchableOpacity>

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

const styles = StyleSheet.create({
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
    backgroundColor: 'rgba(26, 54, 93, 0.1)',
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
