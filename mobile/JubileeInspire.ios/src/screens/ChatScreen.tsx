/**
 * Jubilee Inspire - Chat Screen
 *
 * ChatGPT-style conversation interface with streaming messages.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
  ScrollView,
  Dimensions,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';

import { spacing } from '../config';
import { ChatMessage, Conversation, RootStackParamList } from '../types';
import { MessageBubble, TypingIndicator, ChatInput, EmptyChat, SettingsModal } from '../components';
import { storage } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';

// Helper function to get initials from a name
const getInitials = (name: string): string => {
  if (!name) return 'GU';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
};

// Helper function to get first name from display name
const getFirstName = (name: string): string => {
  if (!name) return 'Guest';
  const words = name.trim().split(/\s+/);
  return words[0];
};

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// Simulated AI responses for demo
const sampleResponses = [
  "That's a wonderful question about Scripture. Let me share some insights with you.\n\nThe passage you're asking about is one of the most profound in all of Scripture. It speaks to the heart of God's love for humanity and His plan for redemption.",
  "I'd be happy to help you explore this topic further. The Bible has much to say about this, and I'll try to provide a comprehensive understanding.\n\nFirst, let's consider the historical context...",
  "This is a beautiful question that many believers wrestle with. Scripture offers us guidance and comfort in this area.\n\nWhen we look at what Jesus taught, we see a consistent message of love, grace, and transformation.",
  "Great question! The Bible addresses this in several places. Let me walk you through some key passages that relate to your question.\n\nIn the Old Testament, we see...",
];

// Available personas
const personas = [
  { id: 'jubilee-inspire', name: 'JubileeInspire', description: 'Your AI assistant' },
];

const ChatScreen: React.FC<Props> = ({ route, navigation }) => {
  const conversationId = route.params?.conversationId;
  const { user, isAuthenticated, signOut } = useAuth();
  const { colors } = useTheme();
  const { isMobileView } = useDrawer();

  // Get user initials and first name for avatar
  const userInitials = getInitials(user?.displayName || 'Guest');
  const firstName = getFirstName(user?.displayName || 'Guest');

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(personas[0]);
  const [profileMenuPosition, setProfileMenuPosition] = useState({ top: 0, right: 0 });
  const [hoveredProfileItem, setHoveredProfileItem] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const profileButtonRef = useRef<any>(null);

  // Load or create conversation - only triggers when conversationId or timestamp changes
  useEffect(() => {
    const loadConversation = async () => {
      console.log('[ChatScreen] Loading conversation:', {
        conversationId,
        timestamp: route.params?.timestamp,
      });

      if (conversationId) {
        const loaded = await storage.getConversation(conversationId);
        if (loaded) {
          console.log('[ChatScreen] Loaded existing conversation:', loaded.id);
          setConversation(loaded);
          setMessages(loaded.messages);
          setIsTyping(false);
          setStreamingMessageId(null);
          return;
        }
      }

      // No conversationId - this is a new conversation request
      // Check if there's already a pending conversation
      let pendingConv = await storage.loadPendingConversation();

      if (pendingConv) {
        // Reuse the existing pending conversation to avoid duplicates on reload
        console.log('[ChatScreen] Reusing existing pending conversation:', pendingConv.id);
        setConversation(pendingConv);
        setMessages(pendingConv.messages);
        setIsTyping(false);
        setStreamingMessageId(null);
        navigation.setParams({ conversationId: pendingConv.id } as any);
      } else {
        // Create a new pending conversation (not saved to main list yet)
        const newConversation = storage.createNewConversation();
        console.log('[ChatScreen] Created new pending conversation:', newConversation.id);

        // Save as pending conversation (temporary placeholder)
        await storage.savePendingConversation(newConversation);
        console.log('[ChatScreen] Saved as pending conversation');

        setConversation(newConversation);
        setMessages([]);
        // Reset streaming state
        setIsTyping(false);
        setStreamingMessageId(null);

        // Update navigation params to include the new conversation ID
        navigation.setParams({ conversationId: newConversation.id } as any);
      }
    };

    loadConversation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, route.params?.timestamp]);

  // Save conversation when messages change (debounced to reduce saves)
  useEffect(() => {
    if (conversation && messages.length > 0) {
      // Debounce the save to avoid saving on every keystroke during streaming
      const timeoutId = setTimeout(() => {
        const updatedConversation = {
          ...conversation,
          messages,
          updatedAt: new Date(),
          title:
            conversation.title === 'New Conversation' && messages.length > 0
              ? storage.generateTitle(messages[0].content)
              : conversation.title,
          preview: messages[messages.length - 1]?.content.substring(0, 50),
        };
        storage.saveConversation(updatedConversation);
        setConversation(updatedConversation);
      }, 500); // Wait 500ms after last message change before saving

      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const simulateStreaming = async (fullResponse: string, messageId: string) => {
    const words = fullResponse.split(' ');
    let currentContent = '';

    for (let i = 0; i < words.length; i++) {
      currentContent += (i > 0 ? ' ' : '') + words[i];

      setMessages(prev =>
        prev.map(msg =>
          msg.id === messageId
            ? { ...msg, content: currentContent, isStreaming: i < words.length - 1 }
            : msg
        )
      );

      scrollToBottom();
      await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 20));
    }

    setStreamingMessageId(null);
  };

  const handleSend = async (text: string) => {
    if (!text.trim() || isTyping || !conversation) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    scrollToBottom();

    // If this is the first message, promote pending conversation to saved conversation
    if (messages.length === 0) {
      console.log('[ChatScreen] First message sent, promoting pending conversation');
      const updatedConversation = {
        ...conversation,
        messages: [userMessage],
        updatedAt: new Date(),
      };
      await storage.promotePendingConversation(updatedConversation);
      console.log('[ChatScreen] Pending conversation promoted to saved conversation');
    }

    // Show typing indicator
    setIsTyping(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 500));

    setIsTyping(false);

    // Add assistant message with streaming
    const assistantMessage: ChatMessage = {
      id: `msg_${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, assistantMessage]);
    setStreamingMessageId(assistantMessage.id);

    // Get random response and stream it
    const response = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
    await simulateStreaming(response, assistantMessage.id);
  };

  const handleSuggestionPress = (prompt: string) => {
    handleSend(prompt);
  };

  const handleRetry = useCallback(async (messageId: string) => {
    // Find the assistant message to regenerate
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    const assistantMessage = messages[messageIndex];
    if (assistantMessage.role !== 'assistant') return;

    // Find the user message that prompted this response (should be immediately before)
    let userMessageIndex = messageIndex - 1;
    while (userMessageIndex >= 0 && messages[userMessageIndex].role !== 'user') {
      userMessageIndex--;
    }

    if (userMessageIndex < 0) {
      console.warn('[ChatScreen] Could not find user message for retry');
      return;
    }

    // Set the assistant message to streaming state with empty content
    setMessages(prev =>
      prev.map((msg, idx) =>
        idx === messageIndex
          ? { ...msg, content: '', isStreaming: true }
          : msg
      )
    );
    setStreamingMessageId(messageId);

    // Show typing indicator briefly
    setIsTyping(true);
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 300));
    setIsTyping(false);

    // Get a different random response (try to avoid the same one)
    let response = sampleResponses[Math.floor(Math.random() * sampleResponses.length)];

    // Stream the new response into the existing message
    await simulateStreaming(response, messageId);
  }, [messages, simulateStreaming]);

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const handleProfileMenu = () => {
    if (profileButtonRef.current) {
      profileButtonRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
        const screenWidth = Dimensions.get('window').width;
        setProfileMenuPosition({
          top: y + height + 8,
          right: screenWidth - x - width,
        });
        setShowProfileMenu(true);
      });
    } else {
      setShowProfileMenu(true);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble message={item} onRetry={handleRetry} />
  );

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        {/* Hamburger menu shown on mobile view (native or web < 768px) */}
        {(Platform.OS !== 'web' || isMobileView) && (
          <TouchableOpacity onPress={openDrawer} style={styles.headerButton}>
            <Ionicons name="menu" size={24} color={colors.text} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.personaSelector}
          onPress={() => setShowPersonaSelector(true)}
        >
          <Text style={styles.personaText}>{selectedPersona.name}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          ref={profileButtonRef}
          onPress={handleProfileMenu}
          style={styles.headerProfileButton}
        >
          <Text style={styles.headerFirstName}>{firstName}</Text>
          <View style={styles.headerAvatarInitials}>
            <Text style={styles.headerInitialsText}>{userInitials}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Persona Selector Modal */}
      <Modal
        visible={showPersonaSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPersonaSelector(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPersonaSelector(false)}>
          <View style={styles.personaMenu}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Select Persona</Text>
              <TouchableOpacity onPress={() => setShowPersonaSelector(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {personas.map(persona => (
                <TouchableOpacity
                  key={persona.id}
                  style={[
                    styles.personaItem,
                    selectedPersona.id === persona.id && styles.personaItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedPersona(persona);
                    setShowPersonaSelector(false);
                  }}
                >
                  <View style={styles.personaInfo}>
                    <Text style={styles.personaName}>{persona.name}</Text>
                    <Text style={styles.personaDescription}>{persona.description}</Text>
                  </View>
                  {selectedPersona.id === persona.id && (
                    <Ionicons name="checkmark" size={24} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Profile Menu Dropdown */}
      <Modal
        visible={showProfileMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <Pressable style={styles.profileModalOverlay} onPress={() => setShowProfileMenu(false)}>
          <Pressable
            style={[styles.profileDropdown, { top: profileMenuPosition.top, right: profileMenuPosition.right }]}
            onPress={(e) => e.stopPropagation()}
          >
            {/* User Profile Header */}
            <View style={styles.profileDropdownHeader}>
              <View style={styles.profileDropdownAvatar}>
                <Text style={styles.profileDropdownAvatarText}>{userInitials}</Text>
              </View>
              <View style={styles.profileDropdownUserInfo}>
                <Text style={styles.profileDropdownName}>{firstName}</Text>
                <Text style={styles.profileDropdownEmail}>
                  {isAuthenticated && user ? user.email : '@guest'}
                </Text>
              </View>
            </View>

            {/* Menu Items - Settings only for authenticated users */}
            {isAuthenticated && (
              <TouchableOpacity
                style={[styles.profileDropdownItem, hoveredProfileItem === 'settings' && styles.profileDropdownItemHovered]}
                onPress={() => {
                  setShowProfileMenu(false);
                  setShowSettingsModal(true);
                }}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredProfileItem('settings'),
                  onMouseLeave: () => setHoveredProfileItem(null),
                } as any : {})}
              >
                <Ionicons name="settings-outline" size={20} color={colors.text} />
                <Text style={styles.profileDropdownItemText}>Settings</Text>
              </TouchableOpacity>
            )}

            {isAuthenticated ? (
              <TouchableOpacity
                style={[styles.profileDropdownItem, styles.profileDropdownItemLast, hoveredProfileItem === 'signout' && styles.profileDropdownItemHovered]}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try {
                    await signOut();
                  } catch (error) {
                    console.error('Error signing out:', error);
                  }
                }}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredProfileItem('signout'),
                  onMouseLeave: () => setHoveredProfileItem(null),
                } as any : {})}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.text} />
                <Text style={styles.profileDropdownItemText}>Log out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.profileDropdownItem, styles.profileDropdownItemLast, hoveredProfileItem === 'signin' && styles.profileDropdownItemHovered]}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('Auth');
                }}
                {...(Platform.OS === 'web' ? {
                  onMouseEnter: () => setHoveredProfileItem('signin'),
                  onMouseLeave: () => setHoveredProfileItem(null),
                } as any : {})}
              >
                <Ionicons name="log-in-outline" size={20} color={colors.text} />
                <Text style={styles.profileDropdownItemText}>Log in</Text>
              </TouchableOpacity>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings Modal */}
      <SettingsModal
        visible={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onNavigateToAuth={() => navigation.navigate('Auth')}
        onClearHistory={() => {
          // Navigate to new chat after clearing history
          navigation.navigate('Chat', {
            conversationId: undefined,
            timestamp: Date.now()
          } as any);
        }}
      />

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyChatContainer}>
            <View style={styles.emptyChatContent}>
              <EmptyChat onSuggestionPress={handleSuggestionPress} />
              <ChatInput onSend={handleSend} disabled={isTyping || !!streamingMessageId} centered={true} />
            </View>
          </View>
        ) : (
          <>
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={scrollToBottom}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
            />
            <ChatInput onSend={handleSend} disabled={isTyping || !!streamingMessageId} />
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xs,
    gap: spacing.xs,
  },
  headerFirstName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  headerAvatarInitials: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInitialsText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  personaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  personaText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  keyboardAvoid: {
    flex: 1,
  },
  emptyChatContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  emptyChatContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 800,
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  personaMenu: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.lg,
  },
  profileModalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  profileDropdown: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderRadius: 12,
    minWidth: 250,
    borderWidth: 1,
    borderColor: colors.border,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 8,
      },
    }),
  },
  profileDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  profileDropdownAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileDropdownAvatarText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  profileDropdownUserInfo: {
    flex: 1,
  },
  profileDropdownName: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
  },
  profileDropdownEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 1,
  },
  profileDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileDropdownItemHovered: {
    backgroundColor: colors.menuItemHover,
  },
  profileDropdownItemLast: {
    borderBottomWidth: 0,
  },
  profileDropdownItemText: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  personaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  personaItemSelected: {
    backgroundColor: colors.background,
  },
  personaInfo: {
    flex: 1,
  },
  personaName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  personaDescription: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});

export default ChatScreen;
