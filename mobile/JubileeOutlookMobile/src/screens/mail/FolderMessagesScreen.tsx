/**
 * FolderMessagesScreen — Displays messages for a specific folder.
 *
 * Navigated to from the folder list or other navigation points.
 * Receives folderId and folderName via route params. Uses the same
 * message list pattern as MailScreen with pull-to-refresh.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { LoadingSpinner, EmptyState } from '../../components/common';
import { MessageListItem } from '../../components/modules/mail/MessageListItem';
import { mailService } from '../../services/mail/mailService';
import type { EmailMessage } from '../../types';
import type { MailStackParamList } from '../../types/navigation';

type FolderMessagesNav = NativeStackNavigationProp<MailStackParamList, 'FolderMessages'>;
type FolderMessagesRoute = RouteProp<MailStackParamList, 'FolderMessages'>;

export default function FolderMessagesScreen() {
  const navigation = useNavigation<FolderMessagesNav>();
  const route = useRoute<FolderMessagesRoute>();

  const { folderId, folderName } = route.params;

  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // ---------- Data Fetching ----------

  const loadMessages = useCallback(async () => {
    try {
      const { messages: msgs } = await mailService.getMessages(folderId, 1, 50);
      setMessages(msgs);
    } catch (err) {
      console.warn('[FolderMessages] loadMessages failed:', err);
      setMessages([]);
    }
  }, [folderId]);

  // Set header title
  useEffect(() => {
    navigation.setOptions({ title: folderName });
  }, [navigation, folderName]);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      await loadMessages();
      if (!cancelled) setIsLoading(false);
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [loadMessages]);

  // ---------- Refresh ----------

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await loadMessages();
    setIsRefreshing(false);
  }, [loadMessages]);

  // ---------- Navigation ----------

  const handleMessagePress = useCallback(
    (message: EmailMessage) => {
      setSelectedMessageId(message.id);
      navigation.navigate('MessageDetail', { messageId: message.id, message });
    },
    [navigation],
  );

  // ---------- Flag Toggle ----------

  const handleToggleFlag = useCallback(
    async (message: EmailMessage) => {
      try {
        const newFlagged = !message.isFlagged;
        await mailService.toggleFlag(message.id, newFlagged);
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, isFlagged: newFlagged } : m)),
        );
      } catch (err) {
        console.warn('[FolderMessages] toggleFlag failed:', err);
      }
    },
    [],
  );

  // ---------- Render ----------

  const renderMessage = useCallback(
    ({ item }: { item: EmailMessage }) => (
      <MessageListItem
        message={item}
        isSelected={selectedMessageId === item.id}
        onPress={() => handleMessagePress(item)}
        onToggleFlag={() => handleToggleFlag(item)}
      />
    ),
    [selectedMessageId, handleMessagePress, handleToggleFlag],
  );

  const keyExtractor = useCallback((item: EmailMessage) => item.id, []);

  if (isLoading) {
    return (
      <View style={styles.screen}>
        <LoadingSpinner fullScreen message={`Loading ${folderName}...`} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {messages.length === 0 ? (
        <EmptyState
          icon="folder-open"
          title="No Messages"
          subtitle={`${folderName} is empty`}
        />
      ) : (
        <FlatList
          data={messages}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
              progressBackgroundColor={Colors.surface}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ---------- Styles ----------

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
