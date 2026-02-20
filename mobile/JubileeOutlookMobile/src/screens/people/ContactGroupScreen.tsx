/**
 * ContactGroupScreen — View and manage members of a contact group.
 *
 * Features:
 * - Displays all group members in alphabetical sections
 * - Header actions: rename group, delete group
 * - Remove individual members (swipe/long-press)
 * - Add members via bottom sheet (shows contacts not in group)
 * - Pull-to-refresh
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import {
  Avatar,
  LoadingSpinner,
  EmptyState,
  FloatingActionButton,
  BottomSheet,
} from '../../components/common';
import { useAlert } from '../../hooks';
import { contactService } from '../../services/contacts/contactService';
import type { Contact, ContactGroup } from '../../types/contacts';
import type { PeopleStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<PeopleStackParamList, 'ContactGroup'>;
type Route = RouteProp<PeopleStackParamList, 'ContactGroup'>;

interface Section {
  title: string;
  data: Contact[];
}

function buildSections(contacts: Contact[]): Section[] {
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

export default function ContactGroupScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { alert, confirm, AlertComponent } = useAlert();
  const { groupId, groupName } = route.params;

  // ── State ───────────────────────────────────────────────
  const [members, setMembers] = useState<Contact[]>([]);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add-member sheet
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addingIds, setAddingIds] = useState<Set<string>>(new Set());

  // Rename sheet
  const [showRenameSheet, setShowRenameSheet] = useState(false);
  const [renameInput, setRenameInput] = useState(groupName);
  const [renameDescInput, setRenameDescInput] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  const sections = useMemo(() => buildSections(members), [members]);

  // Contacts available to add (not already in group, not deleted)
  const availableContacts = useMemo(() => {
    const memberIds = new Set(members.map((m) => m.id));
    let available = allContacts.filter((c) => !memberIds.has(c.id) && !c.isDeleted);
    if (addSearch.trim()) {
      const q = addSearch.trim().toLowerCase();
      available = available.filter(
        (c) =>
          c.displayName.toLowerCase().includes(q) ||
          (c.emailAddresses?.[0] || '').toLowerCase().includes(q) ||
          (c.company || '').toLowerCase().includes(q),
      );
    }
    return available.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allContacts, members, addSearch]);

  // ── Fetch ───────────────────────────────────────────────
  const fetchMembers = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const [memberResult, allResult] = await Promise.all([
        contactService.getGroupMembers(groupId),
        contactService.getContacts(1, 500),
      ]);
      setMembers(memberResult);
      setAllContacts(allResult.contacts);
    } catch (err: any) {
      setError(err?.message || 'Failed to load group members');
      if (!silent) alert('Error', err?.message || 'Failed to load group members', 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [groupId, alert]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchMembers(true);
  }, [fetchMembers]);

  const handleDeleteGroup = useCallback(() => {
    confirm(
      'Delete Group',
      `Delete "${groupName}"? Contacts in this group will not be deleted.`,
      async () => {
        try {
          await contactService.deleteGroup(groupId);
          navigation.goBack();
        } catch (err: any) {
          alert('Error', err?.message || 'Failed to delete group', 'error');
        }
      },
      { confirmText: 'Delete', destructive: true },
    );
  }, [groupId, groupName, confirm, alert, navigation]);

  // ── Header actions ──────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: groupName,
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => {
              setRenameInput(groupName);
              setShowRenameSheet(true);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerButton}
          >
            <Icon name="edit" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDeleteGroup}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerButton}
          >
            <Icon name="delete" size={22} color={Colors.error} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [groupName, navigation, handleDeleteGroup]);

  // ── Rename ──────────────────────────────────────────────
  const handleRename = useCallback(async () => {
    const name = renameInput.trim();
    if (!name) {
      alert('Validation', 'Group name is required', 'warning');
      return;
    }
    setIsSavingRename(true);
    try {
      await contactService.updateGroup(groupId, name, renameDescInput.trim());
      navigation.setOptions({ title: name });
      setShowRenameSheet(false);
    } catch (err: any) {
      alert('Error', err?.message || 'Failed to rename group', 'error');
    } finally {
      setIsSavingRename(false);
    }
  }, [groupId, renameInput, renameDescInput, alert, navigation]);

  // ── Remove member ───────────────────────────────────────
  const handleRemoveMember = useCallback(
    (contact: Contact) => {
      confirm(
        'Remove from Group',
        `Remove ${contact.displayName} from "${groupName}"?`,
        async () => {
          try {
            await contactService.removeMemberFromGroup(groupId, contact.id);
            setMembers((prev) => prev.filter((m) => m.id !== contact.id));
          } catch (err: any) {
            alert('Error', err?.message || 'Failed to remove member', 'error');
          }
        },
        { confirmText: 'Remove', destructive: true },
      );
    },
    [groupId, groupName, confirm, alert],
  );

  // ── Add member ──────────────────────────────────────────
  const handleAddMember = useCallback(
    async (contact: Contact) => {
      setAddingIds((prev) => new Set(prev).add(contact.id));
      try {
        await contactService.addMembersToGroup(groupId, [contact.id]);
        setMembers((prev) => [...prev, contact]);
      } catch (err: any) {
        alert('Error', err?.message || 'Failed to add member', 'error');
      } finally {
        setAddingIds((prev) => {
          const next = new Set(prev);
          next.delete(contact.id);
          return next;
        });
      }
    },
    [groupId, alert],
  );

  // ── Navigate to contact ─────────────────────────────────
  const handleContactPress = useCallback(
    (contact: Contact) => {
      navigation.navigate('ContactDetail', {
        contactId: contact.id,
        contact,
      });
    },
    [navigation],
  );

  // ── Render: member row ──────────────────────────────────
  const renderMemberItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactRow}
      onPress={() => handleContactPress(item)}
      onLongPress={() => handleRemoveMember(item)}
      activeOpacity={0.7}
    >
      <Avatar name={item.displayName} imageUrl={item.photoUrl} size={44} />
      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>
          {item.displayName}
        </Text>
        <Text style={styles.contactSubtitle} numberOfLines={1}>
          {[item.jobTitle, item.company].filter(Boolean).join(' at ') ||
            item.emailAddresses?.[0] || ''}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleRemoveMember(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name="remove-circle-outline" size={22} color={Colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  // ── Render: add-member bottom sheet ─────────────────────
  const renderAddSheet = () => (
    <BottomSheet
      visible={showAddSheet}
      onClose={() => {
        setShowAddSheet(false);
        setAddSearch('');
      }}
      title="Add Members"
      maxHeight="80%"
    >
      <View style={styles.addSheetSearch}>
        <Icon name="search" size={20} color={Colors.textTertiary} />
        <TextInput
          style={styles.addSheetInput}
          value={addSearch}
          onChangeText={setAddSearch}
          placeholder="Search contacts"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
        />
      </View>
      <FlatList
        data={availableContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isAdding = addingIds.has(item.id);
          return (
            <TouchableOpacity
              style={styles.addRow}
              onPress={() => handleAddMember(item)}
              disabled={isAdding}
              activeOpacity={0.7}
            >
              <Avatar name={item.displayName} imageUrl={item.photoUrl} size={36} />
              <View style={styles.contactInfo}>
                <Text style={styles.contactName} numberOfLines={1}>
                  {item.displayName}
                </Text>
                <Text style={styles.contactSubtitle} numberOfLines={1}>
                  {item.emailAddresses?.[0] || ''}
                </Text>
              </View>
              {isAdding ? (
                <LoadingSpinner size="small" />
              ) : (
                <Icon name="add-circle-outline" size={22} color={Colors.primary} />
              )}
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.addEmpty}>
            <Text style={styles.addEmptyText}>
              {addSearch ? 'No matching contacts' : 'All contacts are already in this group'}
            </Text>
          </View>
        }
      />
    </BottomSheet>
  );

  // ── Render: rename bottom sheet ─────────────────────────
  const renderRenameSheet = () => (
    <BottomSheet
      visible={showRenameSheet}
      onClose={() => setShowRenameSheet(false)}
      title="Rename Group"
    >
      <View style={styles.dialogContent}>
        <Text style={styles.dialogLabel}>Name</Text>
        <TextInput
          style={styles.dialogInput}
          value={renameInput}
          onChangeText={setRenameInput}
          placeholder="Group name"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
        />
        <Text style={[styles.dialogLabel, { marginTop: Spacing.md }]}>Description (optional)</Text>
        <TextInput
          style={styles.dialogInput}
          value={renameDescInput}
          onChangeText={setRenameDescInput}
          placeholder="Description"
          placeholderTextColor={Colors.textTertiary}
        />
        <TouchableOpacity
          style={[styles.dialogSaveButton, isSavingRename && { opacity: 0.6 }]}
          onPress={handleRename}
          disabled={isSavingRename}
          activeOpacity={0.8}
        >
          {isSavingRename ? (
            <LoadingSpinner size="small" color={Colors.textInverse} />
          ) : (
            <Text style={styles.dialogSaveText}>Update</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );

  // ── Main render ─────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error && members.length === 0) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon="error-outline"
          title="Failed to load members"
          subtitle={error}
        />
        {AlertComponent}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Member count header */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>
          {members.length} member{members.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderMemberItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={
          sections.length === 0 ? styles.emptyList : styles.memberList
        }
        ListEmptyComponent={
          <EmptyState
            icon="group"
            title="No members yet"
            subtitle="Tap + to add contacts to this group"
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

      <FloatingActionButton
        icon="person-add"
        onPress={() => setShowAddSheet(true)}
      />

      {renderAddSheet()}
      {renderRenameSheet()}
      {AlertComponent}
    </View>
  );
}

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

  // Header
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: Spacing.lg,
  },

  // Count bar
  countBar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  countText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
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

  // Member list
  memberList: {
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

  // Add member sheet
  addSheetSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
  },
  addSheetInput: {
    flex: 1,
    color: Colors.textPrimary,
    ...Typography.body,
    padding: 0,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  addEmpty: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  addEmptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },

  // Dialog (rename)
  dialogContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  dialogLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  dialogInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    ...Typography.body,
  },
  dialogSaveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    minHeight: 48,
  },
  dialogSaveText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});
