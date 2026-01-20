/**
 * Jubilee Inspire - Message Bubble Component
 *
 * Displays a single chat message with appropriate styling for user/assistant.
 * Includes ChatGPT-style action bar with Copy, Good/Bad Response, Share, Try Again, and More options.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert, Platform, Pressable, Modal, TouchableWithoutFeedback, Share, TextInput, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { ChatMessage } from '../types';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const jubileeProfile = require('../../assets/jubilee-profile.png');

// Predefined report reasons
const REPORT_REASONS = [
  { id: 'inappropriate', label: 'Inappropriate content', icon: 'warning-outline' as const },
  { id: 'incorrect', label: 'Incorrect information', icon: 'close-circle-outline' as const },
  { id: 'offensive', label: 'Offensive language', icon: 'alert-circle-outline' as const },
  { id: 'spam', label: 'Spam or misleading', icon: 'mail-unread-outline' as const },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' as const },
];

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
  const [showShareModal, setShowShareModal] = useState(false);
  const [responseTextCopied, setResponseTextCopied] = useState(false);
  const [responseLinkCopied, setResponseLinkCopied] = useState(false);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Report modal states
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportReason, setSelectedReportReason] = useState<string | null>(null);
  const [reportComments, setReportComments] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);

  // Read aloud states
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Reset feedback and copy states when message starts streaming (retry)
  useEffect(() => {
    if (message.isStreaming) {
      setFeedback(null);
      setCopied(false);
      setShowMoreMenu(false);
    }
  }, [message.isStreaming]);

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
    setResponseTextCopied(false);
    setResponseLinkCopied(false);
    setShareSuccess(false);
    setShowShareModal(true);
  };

  const handleCloseShareModal = () => {
    setShowShareModal(false);
    setResponseTextCopied(false);
    setResponseLinkCopied(false);
    setShareSuccess(false);
  };

  const handleCopyResponseText = async () => {
    try {
      await Clipboard.setStringAsync(message.content);
      setResponseTextCopied(true);
      setTimeout(() => setResponseTextCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy response:', error);
      Alert.alert('Error', 'Failed to copy response to clipboard');
    }
  };

  const handleCopyResponseLink = async () => {
    const shareUrl = `https://inspire.jubileeenterprise.com/message/${message.id}`;
    try {
      await Clipboard.setStringAsync(shareUrl);
      setResponseLinkCopied(true);
      setTimeout(() => setResponseLinkCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
      Alert.alert('Error', 'Failed to copy link to clipboard');
    }
  };

  const handleShareResponse = async () => {
    const shareUrl = `https://inspire.jubileeenterprise.com/message/${message.id}`;
    const previewText = message.content.length > 100
      ? message.content.substring(0, 100) + '...'
      : message.content;

    try {
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: 'Jubilee Inspire Response',
            text: previewText,
            url: shareUrl,
          });
          setShareSuccess(true);
          setTimeout(() => {
            handleCloseShareModal();
          }, 1500);
        } else {
          // Fallback to copy link for browsers without Web Share API
          await handleCopyResponseLink();
        }
      } else {
        const result = await Share.share({
          message: `${previewText}\n\n${shareUrl}`,
          title: 'Jubilee Inspire Response',
        });
        if (result.action === Share.sharedAction) {
          setShareSuccess(true);
          setTimeout(() => {
            handleCloseShareModal();
          }, 1500);
        }
      }
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

  const getMessagePreview = () => {
    const maxLength = 80;
    if (message.content.length <= maxLength) {
      return message.content;
    }
    return message.content.substring(0, maxLength) + '...';
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

  const handleReadAloud = async () => {
    // If already speaking, stop it (keep menu open)
    if (isSpeaking) {
      await Speech.stop();
      setIsSpeaking(false);
      return;
    }

    // Start speaking (keep menu open so user can stop from same menu)
    setIsSpeaking(true);

    Speech.speak(message.content, {
      language: 'en-US',
      pitch: 1.0,
      rate: 0.9,
      onStart: () => {
        console.log('[MessageBubble] Speech started');
      },
      onDone: () => {
        console.log('[MessageBubble] Speech completed');
        setIsSpeaking(false);
        // Close menu when speech completes naturally
        setShowMoreMenu(false);
      },
      onStopped: () => {
        console.log('[MessageBubble] Speech stopped');
        setIsSpeaking(false);
      },
      onError: (error) => {
        console.error('[MessageBubble] Speech error:', error);
        setIsSpeaking(false);
        setShowMoreMenu(false);
        Alert.alert('Error', 'Failed to read message aloud. Please try again.');
      },
    });

    // Call the callback if provided
    if (onReadAloud) {
      onReadAloud(message.content);
    }
  };

  // Stop speech when component unmounts or message changes
  useEffect(() => {
    return () => {
      if (isSpeaking) {
        Speech.stop();
      }
    };
  }, [isSpeaking]);

  // Stop speech when message starts streaming (retry)
  useEffect(() => {
    if (message.isStreaming && isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
    }
  }, [message.isStreaming, isSpeaking]);

  const handleReportMessage = () => {
    setShowMoreMenu(false);
    setSelectedReportReason(null);
    setReportComments('');
    setReportSuccess(false);
    setShowReportModal(true);
  };

  const handleCloseReportModal = () => {
    setShowReportModal(false);
    setSelectedReportReason(null);
    setReportComments('');
    setReportSubmitting(false);
    setReportSuccess(false);
  };

  const handleReportModalKeyPress = (e: any) => {
    if (e.key === 'Escape') {
      handleCloseReportModal();
    }
  };

  const handleSubmitReport = async () => {
    if (!selectedReportReason) {
      Alert.alert('Select a reason', 'Please select a reason for reporting this message.');
      return;
    }

    setReportSubmitting(true);

    // Simulate API call to submit report
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In production, this would send to the API:
    // await inspireApi.reportMessage({
    //   messageId: message.id,
    //   reason: selectedReportReason,
    //   comments: reportComments,
    // });

    console.log('[MessageBubble] Report submitted:', {
      messageId: message.id,
      reason: selectedReportReason,
      comments: reportComments,
    });

    setReportSubmitting(false);
    setReportSuccess(true);

    // Auto-close after showing success
    setTimeout(() => {
      handleCloseReportModal();
    }, 2000);

    // Call the callback if provided
    if (onReportMessage) {
      onReportMessage(message.id);
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
        <View style={styles.roleLabelRow}>
          <Text style={[dynamicStyles.roleLabel, isUser && dynamicStyles.userRoleLabel]}>
            {isUser ? 'You' : 'Jubilee Inspire'}
          </Text>
          {isSpeaking && isAssistant && (
            <View style={[styles.speakingIndicator, { backgroundColor: `${colors.primary}20` }]}>
              <Ionicons name="volume-high" size={12} color={colors.primary} />
              <Text style={[styles.speakingText, { color: colors.primary }]}>Speaking</Text>
            </View>
          )}
        </View>
        <Text style={dynamicStyles.messageText}>
          {message.content}
          {message.isStreaming && <Text style={dynamicStyles.cursor}>|</Text>}
        </Text>

        {/* Action Bar - Show only for completed assistant messages */}
        {!message.isStreaming && isAssistant && (
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
              {/* More Options Popup Menu with click-outside overlay */}
              {showMoreMenu && (
                <>
                  {/* Invisible overlay to capture clicks outside the menu */}
                  <Pressable
                    style={styles.menuOverlay}
                    onPress={() => setShowMoreMenu(false)}
                  />
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
                        hovered && { backgroundColor: colors.surface || 'rgba(0,0,0,0.05)' },
                        isSpeaking && { backgroundColor: `${colors.primary}15` }
                      ]}
                      onPress={handleReadAloud}
                    >
                      <Ionicons
                        name={isSpeaking ? "stop-circle-outline" : "volume-high-outline"}
                        size={16}
                        color={isSpeaking ? colors.primary : colors.text}
                        style={styles.menuIcon}
                      />
                      <Text style={[styles.menuText, { color: isSpeaking ? colors.primary : colors.text }]}>
                        {isSpeaking ? 'Stop reading' : 'Read aloud'}
                      </Text>
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
                </>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Share Response Modal */}
      <Modal
        visible={showShareModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseShareModal}
      >
        <TouchableOpacity
          style={styles.shareModalOverlay}
          activeOpacity={1}
          onPress={handleCloseShareModal}
          {...(Platform.OS === 'web' ? { onKeyDown: handleShareModalKeyPress } as any : {})}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e: any) => e.stopPropagation()}
            style={[styles.shareModalContent, { backgroundColor: colors.background }]}
          >
            {/* Success State */}
            {shareSuccess ? (
              <View style={styles.shareSuccessContainer}>
                <View style={[styles.shareSuccessIcon, { backgroundColor: '#10b981' }]}>
                  <Ionicons name="checkmark" size={32} color="#ffffff" />
                </View>
                <Text style={[styles.shareSuccessText, { color: colors.text }]}>
                  Shared successfully!
                </Text>
              </View>
            ) : (
              <>
                {/* Header */}
                <View style={styles.shareModalHeader}>
                  <View style={styles.shareModalTitleRow}>
                    <Ionicons name="share-social-outline" size={24} color={colors.primary} />
                    <Text style={[styles.shareModalTitle, { color: colors.text }]}>
                      Share Response
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.shareModalCloseButton, { backgroundColor: colors.surface }]}
                    onPress={handleCloseShareModal}
                  >
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Response Preview */}
                <View style={[styles.shareResponsePreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.shareResponseHeader}>
                    <Image source={jubileeProfile} style={styles.sharePreviewAvatar as any} />
                    <Text style={[styles.sharePreviewLabel, { color: colors.textSecondary }]}>
                      Jubilee Inspire
                    </Text>
                  </View>
                  <Text style={[styles.sharePreviewText, { color: colors.text }]} numberOfLines={3}>
                    {getMessagePreview()}
                  </Text>
                </View>

                {/* Share Options */}
                <View style={styles.shareOptionsContainer}>
                  <TouchableOpacity
                    style={[styles.shareOptionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={handleCopyResponseText}
                  >
                    <View style={[styles.shareOptionIconWrapper, { backgroundColor: responseTextCopied ? '#22c55e15' : `${colors.primary}15` }]}>
                      <Ionicons
                        name={responseTextCopied ? "checkmark-circle" : "document-text-outline"}
                        size={20}
                        color={responseTextCopied ? "#22c55e" : colors.primary}
                      />
                    </View>
                    <View style={styles.shareOptionTextContainer}>
                      <Text style={[styles.shareOptionTitle, { color: responseTextCopied ? "#22c55e" : colors.text }]}>
                        {responseTextCopied ? 'Copied!' : 'Copy Response'}
                      </Text>
                      <Text style={[styles.shareOptionDesc, { color: colors.textSecondary }]}>
                        Copy the full response text
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareOptionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={handleCopyResponseLink}
                  >
                    <View style={[styles.shareOptionIconWrapper, { backgroundColor: responseLinkCopied ? '#22c55e15' : `${colors.primary}15` }]}>
                      <Ionicons
                        name={responseLinkCopied ? "checkmark-circle" : "link-outline"}
                        size={20}
                        color={responseLinkCopied ? "#22c55e" : colors.primary}
                      />
                    </View>
                    <View style={styles.shareOptionTextContainer}>
                      <Text style={[styles.shareOptionTitle, { color: responseLinkCopied ? "#22c55e" : colors.text }]}>
                        {responseLinkCopied ? 'Copied!' : 'Copy Link'}
                      </Text>
                      <Text style={[styles.shareOptionDesc, { color: colors.textSecondary }]}>
                        Get a shareable link to this response
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareOptionButton, styles.shareMainButton, { backgroundColor: colors.primary }]}
                    onPress={handleShareResponse}
                  >
                    <Ionicons name="share-outline" size={20} color="#ffffff" />
                    <Text style={styles.shareMainButtonText}>Share via...</Text>
                  </TouchableOpacity>
                </View>

                {/* Cancel Button */}
                <TouchableOpacity
                  style={styles.shareCancelButton}
                  onPress={handleCloseShareModal}
                >
                  <Text style={[styles.shareCancelButtonText, { color: colors.textSecondary }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Report Message Modal */}
      <Modal
        visible={showReportModal}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCloseReportModal}
      >
        <TouchableOpacity
          style={styles.shareModalOverlay}
          activeOpacity={1}
          onPress={handleCloseReportModal}
          {...(Platform.OS === 'web' ? { onKeyDown: handleReportModalKeyPress } as any : {})}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e: any) => e.stopPropagation()}
            style={[styles.reportModalContent, { backgroundColor: colors.background }]}
          >
            {/* Success State */}
            {reportSuccess ? (
              <View style={styles.reportSuccessContainer}>
                <View style={[styles.reportSuccessIcon, { backgroundColor: '#10b981' }]}>
                  <Ionicons name="checkmark" size={32} color="#ffffff" />
                </View>
                <Text style={[styles.reportSuccessTitle, { color: colors.text }]}>
                  Report Submitted
                </Text>
                <Text style={[styles.reportSuccessDesc, { color: colors.textSecondary }]}>
                  Thank you for your feedback. We'll review this message.
                </Text>
              </View>
            ) : (
              <>
                {/* Header */}
                <View style={styles.reportModalHeader}>
                  <View style={styles.reportModalTitleRow}>
                    <Ionicons name="flag-outline" size={24} color="#ef4444" />
                    <Text style={[styles.reportModalTitle, { color: colors.text }]}>
                      Report Message
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.reportModalCloseButton, { backgroundColor: colors.surface }]}
                    onPress={handleCloseReportModal}
                  >
                    <Ionicons name="close" size={22} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Message Preview */}
                <View style={[styles.reportMessagePreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={styles.reportPreviewHeader}>
                    <Image source={jubileeProfile} style={styles.reportPreviewAvatar as any} />
                    <Text style={[styles.reportPreviewLabel, { color: colors.textSecondary }]}>
                      Jubilee Inspire
                    </Text>
                  </View>
                  <Text style={[styles.reportPreviewText, { color: colors.text }]} numberOfLines={2}>
                    {getMessagePreview()}
                  </Text>
                </View>

                {/* Report Reasons */}
                <Text style={[styles.reportSectionLabel, { color: colors.text }]}>
                  Why are you reporting this message?
                </Text>
                <ScrollView style={styles.reportReasonsContainer} showsVerticalScrollIndicator={false}>
                  {REPORT_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.id}
                      style={[
                        styles.reportReasonButton,
                        {
                          backgroundColor: selectedReportReason === reason.id ? `${colors.primary}15` : colors.surface,
                          borderColor: selectedReportReason === reason.id ? colors.primary : colors.border,
                        }
                      ]}
                      onPress={() => setSelectedReportReason(reason.id)}
                    >
                      <View style={[
                        styles.reportReasonRadio,
                        {
                          borderColor: selectedReportReason === reason.id ? colors.primary : colors.textSecondary,
                          backgroundColor: selectedReportReason === reason.id ? colors.primary : 'transparent',
                        }
                      ]}>
                        {selectedReportReason === reason.id && (
                          <Ionicons name="checkmark" size={12} color="#ffffff" />
                        )}
                      </View>
                      <Ionicons
                        name={reason.icon}
                        size={18}
                        color={selectedReportReason === reason.id ? colors.primary : colors.textSecondary}
                        style={styles.reportReasonIcon}
                      />
                      <Text style={[
                        styles.reportReasonText,
                        { color: selectedReportReason === reason.id ? colors.primary : colors.text }
                      ]}>
                        {reason.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Additional Comments */}
                <Text style={[styles.reportSectionLabel, { color: colors.text, marginTop: spacing.md }]}>
                  Additional comments (optional)
                </Text>
                <TextInput
                  style={[
                    styles.reportCommentsInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      color: colors.text,
                    }
                  ]}
                  placeholder="Provide more details about the issue..."
                  placeholderTextColor={colors.placeholder}
                  value={reportComments}
                  onChangeText={setReportComments}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />

                {/* Action Buttons */}
                <View style={styles.reportActionsContainer}>
                  <TouchableOpacity
                    style={[styles.reportCancelButton, { borderColor: colors.border }]}
                    onPress={handleCloseReportModal}
                  >
                    <Text style={[styles.reportCancelButtonText, { color: colors.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reportSubmitButton,
                      {
                        backgroundColor: selectedReportReason ? '#ef4444' : colors.surface,
                        opacity: selectedReportReason ? 1 : 0.6,
                      }
                    ]}
                    onPress={handleSubmitReport}
                    disabled={reportSubmitting || !selectedReportReason}
                  >
                    {reportSubmitting ? (
                      <Text style={styles.reportSubmitButtonText}>Submitting...</Text>
                    ) : (
                      <>
                        <Ionicons name="send-outline" size={16} color="#ffffff" />
                        <Text style={styles.reportSubmitButtonText}>Submit Report</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

// Static styles for action buttons (not dependent on theme)
const styles = StyleSheet.create({
  actionButtonWrapper: {
    position: 'relative',
    zIndex: 100,
    ...Platform.select({
      web: {
        overflow: 'visible',
      },
      default: {},
    }),
  },
  actionButton: {
    padding: 6,
    borderRadius: 4,
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: [{ translateX: '-50%' }],
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    zIndex: 9999,
    minWidth: 70,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 10,
      },
    }),
  },
  tooltipText: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },
  roleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  speakingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
  },
  speakingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreOptionsWrapper: {
    position: 'relative',
    zIndex: 100,
  },
  menuOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
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
  // Share Modal Styles
  shareModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareModalContent: {
    borderRadius: 12,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 420,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
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
  },
  shareModalCloseButton: {
    padding: spacing.xs,
    borderRadius: 6,
  },
  shareResponsePreview: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  shareResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  sharePreviewAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  sharePreviewLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  sharePreviewText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
  },
  shareOptionsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  shareOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    gap: spacing.md,
  },
  shareOptionIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareOptionTextContainer: {
    flex: 1,
  },
  shareOptionTitle: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  shareOptionDesc: {
    fontSize: typography.fontSize.xs,
  },
  shareMainButton: {
    justifyContent: 'center',
    borderWidth: 0,
    paddingVertical: spacing.md + 2,
    gap: spacing.sm,
  },
  shareMainButtonText: {
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
    fontWeight: '500',
  },
  shareSuccessContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  shareSuccessIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  shareSuccessText: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  // Report Modal Styles
  reportModalContent: {
    borderRadius: 12,
    padding: spacing.xl,
    width: '90%',
    maxWidth: 440,
    maxHeight: '85%',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  reportModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  reportModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reportModalTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
  },
  reportModalCloseButton: {
    padding: spacing.xs,
    borderRadius: 6,
  },
  reportMessagePreview: {
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  reportPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  reportPreviewAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  reportPreviewLabel: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
  },
  reportPreviewText: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  reportSectionLabel: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  reportReasonsContainer: {
    maxHeight: 200,
  },
  reportReasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  reportReasonRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  reportReasonIcon: {
    marginRight: spacing.sm,
  },
  reportReasonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '500',
    flex: 1,
  },
  reportCommentsInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: typography.fontSize.sm,
    minHeight: 80,
    marginBottom: spacing.lg,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      },
      default: {},
    }),
  },
  reportActionsContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reportCancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCancelButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  reportSubmitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  reportSubmitButtonText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: '#ffffff',
  },
  reportSuccessContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  reportSuccessIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reportSuccessTitle: {
    fontSize: typography.fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  reportSuccessDesc: {
    fontSize: typography.fontSize.sm,
    textAlign: 'center',
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
    overflow: 'visible',
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
    overflow: 'visible',
    zIndex: 50,
  },
});

export default MessageBubble;
