/**
 * PeopleScreen — Alphabetically sorted contact list with search,
 * filtering (All / Favorites / Groups), and pull-to-refresh.
 *
 * Uses SectionList with sections keyed by the first letter of each
 * contact's displayName. Supports long-press context actions and a
 * FAB for creating new contacts.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import {
  Avatar,
  LoadingSpinner,
  EmptyState,
  FloatingActionButton,
  SearchBar,
} from '../../components/common';
import { contactService } from '../../services/contacts/contactService';
import type { Contact, ContactGroup } from '../../types/contacts';
import type { PeopleStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<PeopleStackParamList, 'PeopleMain'>;

type FilterTab = 'all' | 'favorites' | 'groups';

interface ContactSection {
  title: string;
  data: Contact[];
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function buildSections(contacts: Contact[]): ContactSection[] {
  const map = new Map<string, Contact[]>();

  const sorted = [...contacts].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );

  for (const c of sorted) {
    const letter = (c.displayName[0] || '#').toUpperCase();
    const key = /[A-Z]/.test(letter) ? letter : '#';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, data]) => ({ title, data }));
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const PeopleScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Data fetching ────────────────────────────────────────

  const fetchContacts = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const [contactResult, groupsResult] = await Promise.all([
        contactService.getContacts(1, 500),
        contactService.getGroups(),
      ]);
      setContacts(contactResult.contacts);
      setGroups(groupsResult);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load contacts';
      setError(msg);
      if (!silent) Alert.alert('Error', msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const searchContacts = useCallback(async (query: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await contactService.searchContacts(query);
      setContacts(result.contacts);
    } catch (err: any) {
      setError(err?.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const timeout = setTimeout(() => searchContacts(searchQuery.trim()), 400);
      return () => clearTimeout(timeout);
    } else {
      fetchContacts(true);
    }
    return undefined;
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchContacts(true);
  }, [fetchContacts]);

  // ── Filtered data ─────────────────────────────────────────

  const filteredContacts = (() => {
    if (filter === 'favorites') return contacts.filter((c) => c.isFavorite);
    return contacts;
  })();

  const sections = buildSections(filteredContacts);

  // ── Actions ───────────────────────────────────────────────

  const handleContactPress = useCallback(
    (contact: Contact) => {
      navigation.navigate('ContactDetail', {
        contactId: contact.id,
        contact,
      });
    },
    [navigation],
  );

  const handleContactLongPress = useCallback(
    (contact: Contact) => {
      Alert.alert(contact.displayName, 'Choose an action', [
        {
          text: 'Email',
          onPress: () => {
            // Placeholder — email action
            Alert.alert('Email', `Compose email to ${contact.emailAddresses[0] || 'N/A'}`);
          },
        },
        {
          text: 'Call',
          onPress: () => {
            Alert.alert('Call', `Calling ${contact.phoneNumbers[0] || contact.mobilePhone || 'N/A'}`);
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Contact',
              `Are you sure you want to delete ${contact.displayName}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await contactService.softDelete(contact.id);
                      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
                    } catch (err: any) {
                      Alert.alert('Error', err?.message || 'Failed to delete contact');
                    }
                  },
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [],
  );

  const handleToggleFavorite = useCallback(async (contact: Contact) => {
    try {
      await contactService.toggleFavorite(contact.id);
      setContacts((prev) =>
        prev.map((c) =>
          c.id === contact.id ? { ...c, isFavorite: !c.isFavorite } : c,
        ),
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to toggle favorite');
    }
  }, []);

  // ── Render helpers ────────────────────────────────────────

  const renderFilterTabs = () => (
    <View style={styles.filterRow}>
      {(['all', 'favorites', 'groups'] as FilterTab[]).map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[styles.filterTab, filter === tab && styles.filterTabActive]}
          onPress={() => setFilter(tab)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.filterTabText,
              filter === tab && styles.filterTabTextActive,
            ]}
          >
            {tab === 'all' ? 'All' : tab === 'favorites' ? 'Favorites' : 'Groups'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderContactItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactRow}
      onPress={() => handleContactPress(item)}
      onLongPress={() => handleContactLongPress(item)}
      activeOpacity={0.7}
    >
      <Avatar name={item.displayName} photoUrl={item.photoUrl} size={44} />
      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>
          {item.displayName}
        </Text>
        {(item.company || item.jobTitle) && (
          <Text style={styles.contactSubtitle} numberOfLines={1}>
            {[item.jobTitle, item.company].filter(Boolean).join(' at ')}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => handleToggleFavorite(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon
          name={item.isFavorite ? 'star' : 'star-border'}
          size={22}
          color={item.isFavorite ? Colors.primary : Colors.textTertiary}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({
    section,
  }: {
    section: ContactSection;
  }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  const renderGroupItem = (group: ContactGroup) => (
    <TouchableOpacity
      key={group.id}
      style={styles.groupRow}
      onPress={() =>
        navigation.navigate('ContactGroup', {
          groupId: group.id,
          groupName: group.name,
        })
      }
      activeOpacity={0.7}
    >
      <View style={styles.groupIcon}>
        <Icon name="group" size={24} color={Colors.primary} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{group.name}</Text>
        {group.description && (
          <Text style={styles.contactSubtitle} numberOfLines={1}>
            {group.description}
          </Text>
        )}
      </View>
      <Text style={styles.memberCount}>
        {group.memberCount ?? 0}
      </Text>
      <Icon name="chevron-right" size={22} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  // ── Main render ───────────────────────────────────────────

  if (isLoading && contacts.length === 0) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SearchBar
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search contacts"
      />

      {renderFilterTabs()}

      {error && contacts.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="error-outline"
            title="Failed to load contacts"
            message={error}
          />
        </View>
      ) : filter === 'groups' ? (
        groups.length === 0 ? (
          <View style={styles.centered}>
            <EmptyState
              icon="group"
              title="No groups"
              message="Create a group to organize your contacts"
            />
          </View>
        ) : (
          <View style={styles.groupList}>
            {groups.map(renderGroupItem)}
          </View>
        )
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderContactItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={
            sections.length === 0 ? styles.emptyList : styles.contactList
          }
          ListEmptyComponent={
            <EmptyState
              icon="people"
              title="No contacts"
              message={
                filter === 'favorites'
                  ? 'Star contacts to see them here'
                  : 'Add your first contact'
              }
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          stickySectionHeadersEnabled
        />
      )}

      <FloatingActionButton
        icon="person-add"
        onPress={() => navigation.navigate('ContactEdit', {})}
      />
    </View>
  );
};

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  filterTab: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    ...Typography.buttonSmall,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.textInverse,
  },

  // Section headers
  sectionHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sectionHeaderText: {
    ...Typography.label,
    color: Colors.primary,
  },

  // Contact list
  contactList: {
    paddingBottom: 80,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  contactInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  contactName: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  contactSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // Group list
  groupList: {
    flex: 1,
    paddingBottom: 80,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberCount: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginRight: Spacing.xs,
  },
});

export default PeopleScreen;
