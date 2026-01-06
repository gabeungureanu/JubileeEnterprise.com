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
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, DrawerActions } from '@react-navigation/native';

import { colors, spacing } from '../config';
import { ChatMessage, Conversation, RootStackParamList } from '../types';
import { MessageBubble, TypingIndicator, ChatInput, EmptyChat } from '../components';
import { storage } from '../services/storage';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

// Simulated AI responses for demo
const sampleResponses = [
  "That's a wonderful question about Scripture. Let me share some insights with you.\n\nThe passage you're asking about is one of the most profound in all of Scripture. It speaks to the heart of God's love for humanity and His plan for redemption.",
  "I'd be happy to help you explore this topic further. The Bible has much to say about this, and I'll try to provide a comprehensive understanding.\n\nFirst, let's consider the historical context...",
  "This is a beautiful question that many believers wrestle with. Scripture offers us guidance and comfort in this area.\n\nWhen we look at what Jesus taught, we see a consistent message of love, grace, and transformation.",
  "Great question! The Bible addresses this in several places. Let me walk you through some key passages that relate to your question.\n\nIn the Old Testament, we see...",
];

const ChatScreen: React.FC<Props> = ({ route }) => {
  const navigation = useNavigation();
  const conversationId = route.params?.conversationId;

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
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

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Jubilee Inspire</Text>
        </View>

        <TouchableOpacity
          onPress={() => {
            const newConv = storage.createNewConversation();
            setConversation(newConv);
            setMessages([]);
          }}
          style={styles.headerButton}
        >
          <Ionicons name="create-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

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
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  headerButton: {
    padding: spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  keyboardAvoid: {
    flex: 1,
  },
  messageList: {
    paddingVertical: spacing.sm,
  },
});

export default ChatScreen;
