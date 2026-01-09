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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';

import { colors, spacing } from '../config';
import { ChatMessage, Conversation, RootStackParamList } from '../types';
import { MessageBubble, TypingIndicator, ChatInput, EmptyChat } from '../components';
import { storage } from '../services/storage';
import { useAuth } from '../contexts/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// Simulated AI responses for demo
const sampleResponses = [
  "That's a wonderful question about Scripture. Let me share some insights with you.\n\nThe passage you're asking about is one of the most profound in all of Scripture. It speaks to the heart of God's love for humanity and His plan for redemption.",
  "I'd be happy to help you explore this topic further. The Bible has much to say about this, and I'll try to provide a comprehensive understanding.\n\nFirst, let's consider the historical context...",
  "This is a beautiful question that many believers wrestle with. Scripture offers us guidance and comfort in this area.\n\nWhen we look at what Jesus taught, we see a consistent message of love, grace, and transformation.",
  "Great question! The Bible addresses this in several places. Let me walk you through some key passages that relate to your question.\n\nIn the Old Testament, we see...",
];

// Available personas (from Codex DB)
const personas = [
  { id: 'gabriel', name: 'Gabriel', description: 'Default Inspire persona' },
  { id: 'michael', name: 'Michael', description: 'Warrior and protector' },
  { id: 'raphael', name: 'Raphael', description: 'Healer and guide' },
  { id: 'uriel', name: 'Uriel', description: 'Light and wisdom' },
];

const ChatScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation();
  const conversationId = route.params?.conversationId;
  const { user, isAuthenticated, signOut } = useAuth();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [showPersonaSelector, setShowPersonaSelector] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(personas[0]);
  const flatListRef = useRef<FlatList>(null);

  // Load or create conversation
  useEffect(() => {
    const loadConversation = async () => {
      if (conversationId) {
        const loaded = await storage.getConversation(conversationId);
        if (loaded) {
          setConversation(loaded);
          setMessages(loaded.messages);
          return;
        }
      }
      // Create new conversation
      const newConversation = storage.createNewConversation();
      setConversation(newConversation);
      setMessages([]);
    };

    loadConversation();
  }, [conversationId]);

  // Save conversation when messages change
  useEffect(() => {
    if (conversation && messages.length > 0) {
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
    }
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
    if (!text.trim() || isTyping) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    scrollToBottom();

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

  const openDrawer = () => {
    navigation.dispatch(DrawerActions.openDrawer());
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => (
    <MessageBubble message={item} />
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={openDrawer} style={styles.headerButton}>
          <Ionicons name="menu" size={24} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.personaSelector}
          onPress={() => setShowPersonaSelector(true)}
        >
          <Text style={styles.personaText}>{selectedPersona.name}</Text>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowProfileMenu(true)}
          style={styles.headerButton}
        >
          <Ionicons name="person-circle-outline" size={28} color={colors.text} />
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

      {/* Profile Menu Modal */}
      <Modal
        visible={showProfileMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowProfileMenu(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowProfileMenu(false)}>
          <View style={styles.profileMenu}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Account</Text>
              <TouchableOpacity onPress={() => setShowProfileMenu(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.profileInfo}>
              <View style={styles.profileAvatar}>
                <Ionicons name="person" size={40} color={colors.textSecondary} />
              </View>
              <Text style={styles.profileName}>
                {isAuthenticated && user ? user.displayName : 'Guest User'}
              </Text>
              <Text style={styles.profileEmail}>
                {isAuthenticated && user ? user.email : 'Not logged in'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.profileItem}
              onPress={() => {
                setShowProfileMenu(false);
                navigation.navigate('Settings');
              }}
            >
              <Ionicons name="settings-outline" size={24} color={colors.text} />
              <Text style={styles.profileItemText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.profileItem}>
              <Ionicons name="information-circle-outline" size={24} color={colors.text} />
              <Text style={styles.profileItemText}>About</Text>
            </TouchableOpacity>

            {isAuthenticated ? (
              <TouchableOpacity
                style={styles.profileItem}
                onPress={async () => {
                  setShowProfileMenu(false);
                  try {
                    await signOut();
                  } catch (error) {
                    console.error('Error signing out:', error);
                  }
                }}
              >
                <Ionicons name="log-out-outline" size={24} color={colors.text} />
                <Text style={styles.profileItemText}>Sign Out</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.profileItem}
                onPress={() => {
                  setShowProfileMenu(false);
                  navigation.navigate('Auth');
                }}
              >
                <Ionicons name="log-in-outline" size={24} color={colors.text} />
                <Text style={styles.profileItemText}>Sign In</Text>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>

      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        {messages.length === 0 ? (
          <EmptyChat onSuggestionPress={handleSuggestionPress} />
        ) : (
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
        )}

        <ChatInput onSend={handleSend} disabled={isTyping || !!streamingMessageId} />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  profileMenu: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.lg,
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
  profileInfo: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  profileAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  profileItemText: {
    fontSize: 16,
    color: colors.text,
  },
});

export default ChatScreen;
