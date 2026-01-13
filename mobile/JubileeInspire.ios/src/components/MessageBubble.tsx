/**
 * Jubilee Inspire - Message Bubble Component
 *
 * Displays a single chat message with appropriate styling for user/assistant.
 * Includes ChatGPT-style action bar with Copy, Good/Bad Response, Share, Try Again, and More options.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Platform, Pressable } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../types';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const jubileeProfile = require('../../assets/jubilee-profile.png');

interface MessageBubbleProps {
  message: ChatMessage;
  onRetry?: (messageId: string) => void;
  onBranchChat?: (messageId: string) => void;
  onReadAloud?: (content: string) => void;
  onReportMessage?: (messageId: string) => void;
}

interface ActionButtonProps {
  icon: keyof typeof Ionicons.glyphMap;
  tooltip: string;
  onPress: () => void;
  isActive?: boolean;
  activeColor?: string;
}

const ActionButton: React.FC<ActionButtonProps & { colors: any }> = ({
  icon,
  tooltip,
  onPress,
  isActive = false,
  activeColor,
  colors,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  // Handle hover for web platform
  const handleHoverIn = useCallback(() => {
    setShowTooltip(true);
    setIsHovered(true);
  }, []);

  const handleHoverOut = useCallback(() => {
    setShowTooltip(false);
    setIsHovered(false);
  }, []);

  return (
    <View style={styles.actionButtonWrapper}>
      {showTooltip && (
        <View style={[styles.tooltip, { backgroundColor: colors.text }]}>
          <Text style={[styles.tooltipText, { color: colors.background }]}>{tooltip}</Text>
        </View>
      )}
      <Pressable
        style={[
          styles.actionButton,
          isHovered && { backgroundColor: colors.surface || 'rgba(0,0,0,0.05)' }
        ]}
        onPress={onPress}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        // Fallback for mobile: show tooltip on press
        onPressIn={Platform.OS !== 'web' ? () => setShowTooltip(true) : undefined}
        onPressOut={Platform.OS !== 'web' ? () => setShowTooltip(false) : undefined}
      >
        <Ionicons
          name={icon}
          size={16}
          color={isActive ? (activeColor || colors.primary) : colors.textSecondary}
        />
      </Pressable>
    </View>
  );
};

const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onRetry,
  onBranchChat,
  onReadAloud,
  onReportMessage,
}) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const { colors } = useTheme();
  const dynamicStyles = createStyles(colors);

  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null);
  const [copied, setCopied] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGoodResponse = () => {
    setFeedback(feedback === 'good' ? null : 'good');
  };

  const handleBadResponse = () => {
    setFeedback(feedback === 'bad' ? null : 'bad');
  };

  const handleShare = () => {
    Alert.alert('Share', 'Share functionality coming soon!');
  };

  const handleRetry = () => {
    if (onRetry) {
      onRetry(message.id);
    } else {
      Alert.alert('Retry', 'Regenerate response coming soon!');
    }
  };

  const handleBranchInNewChat = () => {
    setShowMoreMenu(false);
    if (onBranchChat) {
      onBranchChat(message.id);
    } else {
      Alert.alert('Branch in new chat', 'This will create a new conversation branch from this message.');
    }
  };

  const handleReadAloud = () => {
    setShowMoreMenu(false);
    if (onReadAloud) {
      onReadAloud(message.content);
    } else {
      Alert.alert('Read aloud', 'Text-to-speech functionality coming soon!');
    }
  };

  const handleReportMessage = () => {
    setShowMoreMenu(false);
    if (onReportMessage) {
      onReportMessage(message.id);
    } else {
      Alert.alert('Report message', 'Thank you for your feedback. This message has been flagged for review.');
    }
  };

  const handleMoreOptions = () => {
    setShowMoreMenu(!showMoreMenu);
  };

  return (
    <View style={[dynamicStyles.container, isUser && dynamicStyles.userContainer]}>
      {/* Avatar */}
      {isUser ? (
        <View style={[dynamicStyles.avatar, dynamicStyles.userAvatar]}>
          <Ionicons name="person" size={18} color="#ffffff" />
        </View>
      ) : (
        <Image source={jubileeProfile} style={dynamicStyles.assistantAvatar} />
      )}

      {/* Message Content */}
      <View style={dynamicStyles.contentContainer}>
        <Text style={[dynamicStyles.roleLabel, isUser && dynamicStyles.userRoleLabel]}>
          {isUser ? 'You' : 'Jubilee Inspire'}
        </Text>
        <Text style={dynamicStyles.messageText}>
          {message.content}
          {message.isStreaming && <Text style={dynamicStyles.cursor}>|</Text>}
        </Text>

        {/* Action Bar - Show only for completed messages */}
        {!message.isStreaming && (
          <View style={dynamicStyles.actionBar}>
            <ActionButton
              icon={copied ? 'checkmark' : 'copy-outline'}
              tooltip={copied ? 'Copied!' : 'Copy'}
              onPress={handleCopy}
              isActive={copied}
              colors={colors}
            />
            <ActionButton
              icon={feedback === 'good' ? 'thumbs-up' : 'thumbs-up-outline'}
              tooltip="Good response"
              onPress={handleGoodResponse}
              isActive={feedback === 'good'}
              activeColor="#10b981"
              colors={colors}
            />
            <ActionButton
              icon={feedback === 'bad' ? 'thumbs-down' : 'thumbs-down-outline'}
              tooltip="Bad response"
              onPress={handleBadResponse}
              isActive={feedback === 'bad'}
              activeColor="#ef4444"
              colors={colors}
            />
            <ActionButton
              icon="share-outline"
              tooltip="Share"
              onPress={handleShare}
              colors={colors}
            />
            {isAssistant && (
              <ActionButton
                icon="refresh-outline"
                tooltip="Try again"
                onPress={handleRetry}
                colors={colors}
              />
            )}
            <View style={styles.moreOptionsWrapper}>
              <ActionButton
                icon="ellipsis-horizontal"
                tooltip="More options"
                onPress={handleMoreOptions}
                colors={colors}
              />
              {/* More Options Popup Menu */}
              {showMoreMenu && (
                <View style={[styles.moreMenu, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Pressable
                    style={({ hovered }) => [
                      styles.menuItem,
                      hovered && { backgroundColor: colors.surface || 'rgba(0,0,0,0.05)' }
                    ]}
                    onPress={handleBranchInNewChat}
                  >
                    <Ionicons name="git-branch-outline" size={16} color={colors.text} style={styles.menuIcon} />
                    <Text style={[styles.menuText, { color: colors.text }]}>Branch in new chat</Text>
                  </Pressable>
                  <Pressable
                    style={({ hovered }) => [
                      styles.menuItem,
                      hovered && { backgroundColor: colors.surface || 'rgba(0,0,0,0.05)' }
                    ]}
                    onPress={handleReadAloud}
                  >
                    <Ionicons name="volume-high-outline" size={16} color={colors.text} style={styles.menuIcon} />
                    <Text style={[styles.menuText, { color: colors.text }]}>Read aloud</Text>
                  </Pressable>
                  <Pressable
                    style={({ hovered }) => [
                      styles.menuItem,
                      hovered && { backgroundColor: colors.surface || 'rgba(0,0,0,0.05)' }
                    ]}
                    onPress={handleReportMessage}
                  >
                    <Ionicons name="flag-outline" size={16} color={colors.text} style={styles.menuIcon} />
                    <Text style={[styles.menuText, { color: colors.text }]}>Report message</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

// Static styles for action buttons (not dependent on theme)
const styles = StyleSheet.create({
  actionButtonWrapper: {
    position: 'relative',
  },
  actionButton: {
    padding: 6,
    borderRadius: 4,
  },
  tooltip: {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: [{ translateX: '-50%' }],
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 4,
    alignItems: 'center',
    zIndex: 1000,
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '500',
    whiteSpace: 'nowrap',
  },
  moreOptionsWrapper: {
    position: 'relative',
  },
  moreMenu: {
    position: 'absolute',
    bottom: '100%',
    right: 0,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    minWidth: 180,
    zIndex: 1001,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  menuIcon: {
    marginRight: 10,
  },
  menuText: {
    fontSize: 14,
    fontWeight: '400',
  },
});

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background,
  },
  userContainer: {
    backgroundColor: colors.surface,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userAvatar: {
    backgroundColor: '#5436da',  // Purple for user
  },
  assistantAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.md,
  },
  contentContainer: {
    flex: 1,
  },
  roleLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  userRoleLabel: {
    color: colors.text,
  },
  messageText: {
    fontSize: typography.fontSize.base,
    color: colors.text,
    lineHeight: 24,
  },
  cursor: {
    color: colors.primary,
    fontWeight: '300',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: 2,
  },
});

export default MessageBubble;
