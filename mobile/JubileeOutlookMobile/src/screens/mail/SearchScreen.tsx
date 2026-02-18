/**
 * SearchScreen — Debounced email search with auto-focus.
 *
 * Uses a 300ms debounce on the search input. Minimum 2 characters
 * before triggering a search. Results are displayed as a message list
 * that navigates to MessageDetail on tap.
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner, EmptyState, SearchBar } from '../../components/common';
import { MessageListItem } from '../../components/modules/mail/MessageListItem';
import { mailService } from '../../services/mail/mailService';
import { useDebounce } from '../../hooks';
import type { EmailMessage } from '../../types';
import type { MailStackParamList } from '../../types/navigation';

type SearchNav = NativeStackNavigationProp<MailStackParamList, 'Search'>;

export default function SearchScreen() {
  const navigation = useNavigation<SearchNav>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<EmailMessage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);

  // ---------- Search ----------

  const performSearch = useCallback(async (searchTerm: string) => {
    setIsSearching(true);
    try {
      const { messages } = await mailService.searchMessages(searchTerm);
      setResults(messages);
    } catch (err) {
      console.warn('[SearchScreen] search failed:', err);
      setResults([]);
    } finally {
      setIsSearching(false);
      setHasSearched(true);
    }
  }, []);

  // Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    performSearch(debouncedQuery.trim());
  }, [debouncedQuery, performSearch]);

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
        setResults((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, isFlagged: newFlagged } : m)),
        );
      } catch (err) {
        console.warn('[SearchScreen] toggleFlag failed:', err);
      }
    },
    [],
  );

  // ---------- Clear ----------

  const handleClear = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, []);

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

  return (
    <View style={styles.screen}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder="Search emails..."
          autoFocus
          onSubmit={() => query.trim().length >= 2 && performSearch(query.trim())}
          onClear={handleClear}
        />
      </View>

      {/* Results */}
      {isSearching ? (
        <LoadingSpinner message="Searching..." />
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.resultHeader}>
              <Text style={styles.resultCount}>
                {results.length} result{results.length !== 1 ? 's' : ''} found
              </Text>
            </View>
          }
        />
      ) : hasSearched ? (
        <EmptyState
          icon="search-off"
          title="No Results"
          subtitle={`No emails found for "${query}"`}
        />
      ) : (
        <EmptyState
          icon="search"
          title="Search Emails"
          subtitle="Type at least 2 characters to search"
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
  searchContainer: {
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  resultHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  resultCount: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
});
