/**
 * Jubilee Inspire - Conversation Item Component
 *
 * Displays a conversation in the sidebar list.
 */

import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Modal, TextInput, Share, Dimensions } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Conversation } from '../types';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  isEditing: boolean;
  onPress: () => void;
  onDelete: () => void;
  onPinToggle: () => void;
  onRename: (newTitle: string) => void;
  onStartEditing: () => void;
  onCancelEditing: () => void;
  searchQuery?: string;
  // Menu state controlled by parent
  isMenuOpen?: boolean;
  onMenuOpen?: (position: { top: number; left: number }) => void;
  onMenuClose?: () => void;
}

// Helper component to highlight search matches
const HighlightedText: React.FC<{
  text: string;
  highlight: string;
  style: any;
  highlightStyle: any;
  numberOfLines?: number;
}> = ({ text, highlight, style, highlightStyle, numberOfLines }) => {
  if (!highlight.trim()) {
    return <Text style={style} numberOfLines={numberOfLines}>{text}</Text>;
  }

  const query = highlight.toLowerCase();
  const parts: { text: string; isMatch: boolean }[] = [];
  let lastIndex = 0;
  const lowerText = text.toLowerCase();

  let index = lowerText.indexOf(query);
  while (index !== -1) {
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index), isMatch: false });
    }
    parts.push({ text: text.slice(index, index + query.length), isMatch: true });
    lastIndex = index + query.length;
    index = lowerText.indexOf(query, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isMatch: false });
  }

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {parts.map((part, i) => (
        <Text key={i} style={part.isMatch ? highlightStyle : undefined}>
          {part.text}
        </Text>
      ))}
    </Text>
  );
};

const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isActive,
  isEditing,
  onPress,
  onDelete,
  onPinToggle,
  onRename,
  onStartEditing,
  onCancelEditing,
  searchQuery = '',
  isMenuOpen = false,
  onMenuOpen,
  onMenuClose,
}) => {
  const { colors } = useTheme();
  const { isMobileView } = useDrawer();
  const styles = createStyles(colors);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Use parent-controlled menu state if provided, otherwise use local state
  const [localShowOptionsMenu, setLocalShowOptionsMenu] = useState(false);
  const showOptionsMenu = onMenuOpen ? isMenuOpen : localShowOptionsMenu;
  const setShowOptionsMenu = onMenuOpen
    ? (show: boolean) => { if (show && onMenuOpen) onMenuOpen({ top: 0, left: 0 }); else if (onMenuClose) onMenuClose(); }
    : setLocalShowOptionsMenu;
  const [showShareModal, setShowShareModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [editTitle, setEditTitle] = useState(conversation.title);
  const [canBlur, setCanBlur] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const menuButtonRef = useRef<TouchableOpacity>(null);
  const inputRef = useRef<TextInput>(null);

  // Focus input and reset title when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setEditTitle(conversation.title);
      setCanBlur(false); // Prevent immediate blur
      if (inputRef.current) {
        inputRef.current.focus();
      }
      // Allow blur after a short delay to prevent immediate cancellation
      const timer = setTimeout(() => {
        setCanBlur(true);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setCanBlur(false);
    }
  }, [isEditing, conversation.title]);

  // Update editTitle when conversation title changes externally
  useEffect(() => {
    setEditTitle(conversation.title);
  }, [conversation.title]);

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

  const closeMenu = () => {
    if (onMenuClose) {
      onMenuClose();
    } else {
      setLocalShowOptionsMenu(false);
    }
  };

  const handleOptionPress = (option: string) => {
    switch (option) {
      case 'share':
        closeMenu();
        setLinkCopied(false);
        setShowShareModal(true);
        break;
      case 'rename':
        // Close menu and notify parent to enter edit mode
        closeMenu();
        setEditTitle(conversation.title);
        // Use setTimeout to ensure modal is fully closed before entering edit mode
        setTimeout(() => {
          onStartEditing();
        }, 50);
        break;
      case 'pin':
        closeMenu();
        onPinToggle();
        break;
      case 'archive':
        closeMenu();
        Alert.alert('Archive', 'Archive functionality coming soon!');
        break;
      case 'delete':
        closeMenu();
        handleDelete();
        break;
      default:
        closeMenu();
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

  const handleRenameConfirm = () => {
    const trimmedTitle = editTitle.trim();
    if (trimmedTitle.length > 0 && trimmedTitle !== conversation.title) {
      onRename(trimmedTitle);
    } else {
      // Reset to original title if empty or unchanged
      setEditTitle(conversation.title);
      onCancelEditing();
    }
  };

  const handleBlur = () => {
    // Only process blur if enough time has passed since entering edit mode
    if (canBlur) {
      handleRenameConfirm();
    }
  };

  const handleRenameCancel = () => {
    setEditTitle(conversation.title);
    onCancelEditing();
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
    setLinkCopied(false);
  };

  const handleCopyLink = async () => {
    const shareUrl = `https://inspire.jubileeenterprise.com/chat/${conversation.id}`;
    try {
      await Clipboard.setStringAsync(shareUrl);
      setLinkCopied(true);
      // Reset after 2 seconds
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      Alert.alert('Error', 'Failed to copy link to clipboard');
    }
  };

  const handleShare = async () => {
    const shareUrl = `https://inspire.jubileeenterprise.com/chat/${conversation.id}`;
    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: conversation.title,
            text: `Check out this conversation: ${conversation.title}`,
            url: shareUrl,
          });
        } else {
          // Fallback to copy link for browsers without Web Share API
          await handleCopyLink();
        }
      } else {
        await Share.share({
          message: `Check out this conversation: ${conversation.title}\n${shareUrl}`,
          title: conversation.title,
        });
      }
      handleCloseShareModal();
    } catch (error) {
      if ((error as any).name !== 'AbortError') {
        console.error('Failed to share:', error);
      }
    }
  };

  const handleShareModalKeyPress = (e: any) => {
    if (e.key === 'Escape') {
      handleCloseShareModal();
    }
  };

  const handleKeyPress = (e: any) => {
    if (e.nativeEvent.key === 'Enter') {
      e.preventDefault();
      handleRenameConfirm();
    } else if (e.nativeEvent.key === 'Escape') {
      handleRenameCancel();
    }
  };

  return (
    <>
      <View style={styles.itemWrapper}>
        <TouchableOpacity
          style={[styles.container, isActive && styles.activeContainer]}
          onPress={isEditing ? undefined : onPress}
          activeOpacity={isEditing ? 1 : 0.7}
          disabled={isEditing}
          {...(Platform.OS === 'web' ? {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false)
          } as any : {})}
        >
          <View style={styles.iconContainer}>
            {conversation.isPinned ? (
              <Ionicons
                name="pin"
                size={16}
                color={colors.primary}
                accessibilityLabel="Pinned conversation"
              />
            ) : (
              <Ionicons
                name="chatbubble-outline"
                size={18}
                color={isActive ? colors.primary : colors.textSecondary}
              />
            )}
          </View>

          <View style={styles.contentContainer}>
            {isEditing ? (
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e: any) => e.stopPropagation()}
                style={styles.editInputContainer}
              >
                <TextInput
                  ref={inputRef}
                  style={[styles.title, styles.titleInput, isActive && styles.activeTitle]}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  onBlur={handleBlur}
                  onKeyPress={handleKeyPress}
                  onSubmitEditing={handleRenameConfirm}
                  selectTextOnFocus
                  autoFocus
                  maxLength={100}
                />
              </TouchableOpacity>
            ) : (
              <HighlightedText
                text={conversation.title}
                highlight={searchQuery}
                style={[styles.title, isActive && styles.activeTitle]}
                highlightStyle={styles.highlightedText}
                numberOfLines={1}
              />
            )}
            {conversation.preview && !isEditing && (
              <HighlightedText
                text={conversation.preview}
                highlight={searchQuery}
                style={styles.preview}
                highlightStyle={styles.highlightedPreview}
                numberOfLines={1}
              />
            )}
          </View>

          {(isHovered || isMobileView || Platform.OS !== 'web') && (
            <TouchableOpacity
              ref={menuButtonRef}
              style={styles.menuButton}
              onPress={(e: any) => {
                e.stopPropagation();
                if (Platform.OS === 'web' && e.target) {
                  const rect = e.target.getBoundingClientRect();
                  // Position menu above the button, aligned to left edge of ellipsis
                  // Menu height is approximately 280px (6 items + divider)
                  const menuHeight = 280;
                  const position = {
                    top: rect.top - menuHeight - 5,
                    left: rect.left,
                  };
                  setMenuPosition(position);
                  // If parent controls menu, pass position to parent
                  if (onMenuOpen) {
                    onMenuOpen(position);
                    return;
                  }
                }
                // For local state control
                if (!onMenuOpen) {
                  setLocalShowOptionsMenu(true);
                }
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

      </View>

      {/* Options Menu Modal - Only render if using local state (not parent-controlled) */}
      {!onMenuOpen ? (
        <Modal
          visible={localShowOptionsMenu}
          transparent={true}
          animationType="fade"
          onRequestClose={closeMenu}
        >
          <TouchableOpacity
            style={styles.menuOverlay}
            activeOpacity={1}
            onPress={closeMenu}
          >
            <View style={[
              styles.menuContent,
              { position: 'absolute', top: menuPosition.top, left: menuPosition.left }
            ]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => handleOptionPress('share')}
              >
                <Ionicons name="share-outline" size={20} color={colors.text} />
                <Text style={styles.menuItemText}>Share</Text>
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
                <Ionicons
                  name={conversation.isPinned ? "pin" : "pin-outline"}
                  size={20}
                  color={colors.text}
                />
                <Text style={styles.menuItemText}>
                  {conversation.isPinned ? 'Unpin chat' : 'Pin chat'}
                </Text>
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
      ) : null}

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

      {/* Share Conversation Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseShareModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={handleCloseShareModal}
          {...(Platform.OS === 'web' ? { onKeyDown: handleShareModalKeyPress } as any : {})}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e: any) => e.stopPropagation()}
            style={styles.shareModalContent}
          >
            {/* Header */}
            <View style={styles.shareModalHeader}>
              <View style={styles.shareModalTitleRow}>
                <Ionicons name="share-social-outline" size={24} color={colors.primary} />
                <Text style={styles.shareModalTitle}>Share Conversation</Text>
              </View>
              <TouchableOpacity
                style={styles.shareModalCloseButton}
                onPress={handleCloseShareModal}
              >
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Conversation Preview */}
            <View style={styles.shareConversationPreview}>
              <Ionicons name="chatbubble-outline" size={18} color={colors.textSecondary} />
              <Text style={styles.shareConversationTitle} numberOfLines={1}>
                {conversation.title}
              </Text>
            </View>

            {/* Share Link Section */}
            <View style={styles.shareLinkSection}>
              <Text style={styles.shareLinkLabel}>Share Link</Text>
              <View style={styles.shareLinkContainer}>
                <Text style={styles.shareLinkText} numberOfLines={1}>
                  inspire.jubileeenterprise.com/chat/{conversation.id.slice(0, 12)}...
                </Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.shareModalButtons}>
              <TouchableOpacity
                style={[styles.shareButton, styles.copyLinkButton]}
                onPress={handleCopyLink}
              >
                <Ionicons
                  name={linkCopied ? "checkmark-circle" : "copy-outline"}
                  size={18}
                  color={linkCopied ? "#22c55e" : colors.primary}
                />
                <Text style={[styles.copyLinkButtonText, linkCopied && styles.copiedText]}>
                  {linkCopied ? 'Copied!' : 'Copy Link'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareButton, styles.shareActionButton]}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={18} color="#ffffff" />
                <Text style={styles.shareActionButtonText}>Share</Text>
              </TouchableOpacity>
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.shareCancelButton}
              onPress={handleCloseShareModal}
            >
              <Text style={styles.shareCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
  titleInput: {
    padding: 4,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
    flex: 1,
  } as any,
  editInputContainer: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginLeft: -5,
    marginRight: -5,
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
  highlightedText: {
    backgroundColor: `${colors.primary}30`,
    color: colors.primary,
    fontWeight: '600',
    borderRadius: 2,
  },
  highlightedPreview: {
    backgroundColor: `${colors.primary}25`,
    color: colors.primary,
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
  // Share Modal Styles
  shareModalContent: {
    backgroundColor: '#2f2f2f',
    borderRadius: 12,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: '#2f2f2f',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  shareModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  shareModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    color: colors.text,
  },
  shareModalCloseButton: {
    padding: spacing.xs,
    borderRadius: 6,
    backgroundColor: colors.surface,
  },
  shareConversationPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareConversationTitle: {
    fontSize: typography.fontSize.sm,
    color: colors.text,
    flex: 1,
  },
  shareLinkSection: {
    marginBottom: spacing.lg,
  },
  shareLinkLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  shareLinkContainer: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  shareLinkText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
  },
  shareModalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    gap: spacing.xs,
  },
  copyLinkButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  copyLinkButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.primary,
  },
  copiedText: {
    color: '#22c55e',
  },
  shareActionButton: {
    backgroundColor: colors.primary,
  },
  shareActionButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },
  shareCancelButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  shareCancelButtonText: {
    fontSize: typography.fontSize.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
});

export default ConversationItem;

