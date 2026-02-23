/**
 * PeopleScreen — Full-featured contact management screen matching Outlook.com.
 *
 * Features:
 * - Filter tabs: All | Favorites | Groups | Deleted
 * - Category filter bar (derived from contacts)
 * - Sort options (name, company, date)
 * - Multi-select with batch actions (delete, restore, hard-delete, category)
 * - Group CRUD (create, rename, delete) via bottom sheet
 * - Pull-to-refresh, search with debounce
 * - Alphabetical section list with sticky headers
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import {
  Avatar,
  LoadingSpinner,
  EmptyState,
  FloatingActionButton,
  SearchBar,
  BottomSheet,
} from '../../components/common';
import { useAlert } from '../../hooks';
import { contactService } from '../../services/contacts/contactService';
import type { Contact, ContactGroup } from '../../types/contacts';
import type { PeopleStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<PeopleStackParamList, 'PeopleMain'>;

type FilterTab = 'all' | 'favorites' | 'groups' | 'deleted';
type SortOption = 'name-asc' | 'name-desc' | 'company-asc' | 'company-desc' | 'date-newest' | 'date-oldest';

interface ContactSection {
  title: string;
  data: Contact[];
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'Name A–Z' },
  { value: 'name-desc', label: 'Name Z–A' },
  { value: 'company-asc', label: 'Company A–Z' },
  { value: 'company-desc', label: 'Company Z–A' },
  { value: 'date-newest', label: 'Newest first' },
  { value: 'date-oldest', label: 'Oldest first' },
];

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function sortContacts(contacts: Contact[], sort: SortOption): Contact[] {
  const sorted = [...contacts];
  switch (sort) {
    case 'name-asc':
      return sorted.sort((a, b) => a.displayName.localeCompare(b.displayName));
    case 'name-desc':
      return sorted.sort((a, b) => b.displayName.localeCompare(a.displayName));
    case 'company-asc':
      return sorted.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
    case 'company-desc':
      return sorted.sort((a, b) => (b.company || '').localeCompare(a.company || ''));
    case 'date-newest':
      return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    case 'date-oldest':
      return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    default:
      return sorted;
  }
}

function buildSections(contacts: Contact[]): ContactSection[] {
  const map = new Map<string, Contact[]>();

  for (const c of contacts) {
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
  const { alert, confirm, AlertComponent } = useAlert();

  // ── Core state ──────────────────────────────────────────
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [sortOption, setSortOption] = useState<SortOption>('name-asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Multi-select state ──────────────────────────────────
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ── Bottom sheet state ──────────────────────────────────
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  // ── Import/Export state ────────────────────────────────
  const [showMoreSheet, setShowMoreSheet] = useState(false);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [showExportSheet, setShowExportSheet] = useState(false);
  const [importFile, setImportFile] = useState<{ name: string; uri: string; format: 'vcard' | 'csv' } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // ── Derived data ────────────────────────────────────────
  const activeContacts = useMemo(
    () => allContacts.filter((c) => !c.isDeleted),
    [allContacts],
  );

  const deletedContacts = useMemo(
    () => allContacts.filter((c) => c.isDeleted),
    [allContacts],
  );

  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of activeContacts) {
      if (c.category) cats.add(c.category);
    }
    return Array.from(cats).sort();
  }, [activeContacts]);

  const filteredContacts = useMemo(() => {
    let base: Contact[];

    // Category filter takes precedence
    if (selectedCategory) {
      base = activeContacts.filter((c) => c.category === selectedCategory);
    } else {
      switch (filter) {
        case 'favorites':
          base = activeContacts.filter((c) => c.isFavorite);
          break;
        case 'deleted':
          base = deletedContacts;
          break;
        case 'groups':
          base = []; // Groups tab shows groups, not contact sections
          break;
        default:
          base = activeContacts;
      }
    }

    return sortContacts(base, sortOption);
  }, [allContacts, filter, sortOption, selectedCategory, activeContacts, deletedContacts]);

  const sections = useMemo(() => buildSections(filteredContacts), [filteredContacts]);

  // ── Data fetching ──────────────────────────────────────
  const fetchAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const [contactResult, groupsResult] = await Promise.all([
        contactService.getContacts(1, 500),
        contactService.getGroups(),
      ]);
      setAllContacts(contactResult.contacts);
      setGroups(groupsResult);
    } catch (err: any) {
      const msg = err?.message || 'Failed to load contacts';
      setError(msg);
      if (!silent) alert('Error', msg, 'error');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [alert]);

  const searchContacts = useCallback(async (query: string) => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await contactService.searchContacts(query);
      // Search only returns active contacts; preserve deleted in state
      const deleted = allContacts.filter((c) => c.isDeleted);
      setAllContacts([...result.contacts, ...deleted]);
    } catch (err: any) {
      setError(err?.message || 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [allContacts]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Refresh on screen focus (after edit/create/delete on other screens)
  useFocusEffect(
    useCallback(() => {
      fetchAll(true);
    }, [fetchAll]),
  );

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const timeout = setTimeout(() => searchContacts(searchQuery.trim()), 400);
      return () => clearTimeout(timeout);
    } else {
      fetchAll(true);
    }
    return undefined;
  }, [searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAll(true);
  }, [fetchAll]);

  // ── Multi-select helpers ────────────────────────────────
  const toggleSelectMode = useCallback(() => {
    setIsSelectMode((prev) => {
      if (prev) setSelectedIds(new Set());
      return !prev;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    const ids = filteredContacts.map((c) => c.id);
    setSelectedIds(new Set(ids));
  }, [filteredContacts]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ── Batch actions ───────────────────────────────────────
  const handleBatchSoftDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    confirm(
      'Delete Contacts',
      `Move ${selectedIds.size} contact${selectedIds.size > 1 ? 's' : ''} to deleted?`,
      async () => {
        try {
          const ids = Array.from(selectedIds);
          await contactService.batchSoftDelete(ids);
          setAllContacts((prev) =>
            prev.map((c) => (ids.includes(c.id) ? { ...c, isDeleted: true } : c)),
          );
          setSelectedIds(new Set());
          setIsSelectMode(false);
        } catch (err: any) {
          alert('Error', err?.message || 'Failed to delete contacts', 'error');
        }
      },
      { confirmText: 'Delete', destructive: true, icon: 'delete-outline' },
    );
  }, [selectedIds, confirm, alert]);

  const handleBatchRestore = useCallback(() => {
    if (selectedIds.size === 0) return;

    // Check for duplicates before restoring (matches web PeoplePage behavior)
    const ids = Array.from(selectedIds);
    const contactsToRestore = allContacts.filter((c) => ids.includes(c.id));
    const withDuplicates: Contact[] = [];
    const safe: Contact[] = [];

    for (const c of contactsToRestore) {
      const dupe = contactService.findActiveDuplicate(c, allContacts);
      if (dupe) withDuplicates.push(c);
      else safe.push(c);
    }

    if (withDuplicates.length > 0 && safe.length === 0) {
      // All have duplicates
      confirm(
        'Duplicates Found',
        `All ${withDuplicates.length} selected contact${withDuplicates.length > 1 ? 's have' : ' has'} active duplicates. Restore anyway?`,
        async () => {
          try {
            await contactService.batchRestore(ids);
            setAllContacts((prev) =>
              prev.map((c) => (ids.includes(c.id) ? { ...c, isDeleted: false } : c)),
            );
            setSelectedIds(new Set());
            setIsSelectMode(false);
          } catch (err: any) {
            alert('Error', err?.message || 'Failed to restore contacts', 'error');
          }
        },
        { confirmText: 'Restore Anyway', icon: 'content-copy', iconColor: Colors.warning },
      );
    } else if (withDuplicates.length > 0) {
      // Some have duplicates — offer to restore only safe ones
      confirm(
        'Duplicates Found',
        `${withDuplicates.length} of ${ids.length} contact${ids.length > 1 ? 's have' : ' has'} active duplicates. Restore the ${safe.length} non-duplicate contact${safe.length !== 1 ? 's' : ''}?`,
        async () => {
          try {
            const safeIds = safe.map((c) => c.id);
            await contactService.batchRestore(safeIds);
            setAllContacts((prev) =>
              prev.map((c) => (safeIds.includes(c.id) ? { ...c, isDeleted: false } : c)),
            );
            setSelectedIds(new Set());
            setIsSelectMode(false);
          } catch (err: any) {
            alert('Error', err?.message || 'Failed to restore contacts', 'error');
          }
        },
        { icon: 'content-copy', iconColor: Colors.warning },
      );
    } else {
      // No duplicates — proceed normally
      confirm(
        'Restore Contacts',
        `Restore ${selectedIds.size} contact${selectedIds.size > 1 ? 's' : ''}?`,
        async () => {
          try {
            await contactService.batchRestore(ids);
            setAllContacts((prev) =>
              prev.map((c) => (ids.includes(c.id) ? { ...c, isDeleted: false } : c)),
            );
            setSelectedIds(new Set());
            setIsSelectMode(false);
          } catch (err: any) {
            alert('Error', err?.message || 'Failed to restore contacts', 'error');
          }
        },
        { icon: 'restore', iconColor: Colors.success },
      );
    }
  }, [selectedIds, allContacts, confirm, alert]);

  const handleBatchHardDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    confirm(
      'Permanently Delete',
      `Permanently delete ${selectedIds.size} contact${selectedIds.size > 1 ? 's' : ''}? This cannot be undone.`,
      async () => {
        try {
          const ids = Array.from(selectedIds);
          await contactService.batchHardDelete(ids);
          setAllContacts((prev) => prev.filter((c) => !ids.includes(c.id)));
          setSelectedIds(new Set());
          setIsSelectMode(false);
        } catch (err: any) {
          alert('Error', err?.message || 'Failed to delete contacts', 'error');
        }
      },
      { confirmText: 'Delete Forever', destructive: true, icon: 'delete-forever' },
    );
  }, [selectedIds, confirm, alert]);

  // ── Single-contact actions ──────────────────────────────
  const handleContactPress = useCallback(
    (contact: Contact) => {
      if (isSelectMode) {
        toggleSelected(contact.id);
        return;
      }
      navigation.navigate('ContactDetail', {
        contactId: contact.id,
        contact,
      });
    },
    [isSelectMode, toggleSelected, navigation],
  );

  const handleContactLongPress = useCallback(
    (contact: Contact) => {
      if (!isSelectMode) {
        setIsSelectMode(true);
        setSelectedIds(new Set([contact.id]));
      }
    },
    [isSelectMode],
  );

  const handleToggleFavorite = useCallback(async (contact: Contact) => {
    try {
      const newVal = !contact.isFavorite;
      // Optimistic
      setAllContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, isFavorite: newVal } : c)),
      );
      await contactService.toggleFavorite(contact.id, newVal);
    } catch (err: any) {
      // Revert
      setAllContacts((prev) =>
        prev.map((c) => (c.id === contact.id ? { ...c, isFavorite: contact.isFavorite } : c)),
      );
      alert('Error', err?.message || 'Failed to toggle favorite', 'error');
    }
  }, [alert]);

  // ── Group CRUD ──────────────────────────────────────────
  const openCreateGroup = useCallback(() => {
    setEditingGroup(null);
    setGroupNameInput('');
    setGroupDescInput('');
    setShowGroupDialog(true);
  }, []);

  const openRenameGroup = useCallback((group: ContactGroup) => {
    setEditingGroup(group);
    setGroupNameInput(group.name);
    setGroupDescInput(group.description || '');
    setShowGroupDialog(true);
  }, []);

  const handleSaveGroup = useCallback(async () => {
    const name = groupNameInput.trim();
    if (!name) {
      alert('Validation', 'Group name is required', 'warning');
      return;
    }
    setIsSavingGroup(true);
    try {
      if (editingGroup) {
        const updated = await contactService.updateGroup(editingGroup.id, name, groupDescInput.trim());
        if (updated) {
          setGroups((prev) => prev.map((g) => (g.id === editingGroup.id ? updated : g)));
        }
      } else {
        const created = await contactService.createGroup(name, groupDescInput.trim());
        if (created) {
          setGroups((prev) => [...prev, created]);
        }
      }
      setShowGroupDialog(false);
    } catch (err: any) {
      alert('Error', err?.message || 'Failed to save group', 'error');
    } finally {
      setIsSavingGroup(false);
    }
  }, [editingGroup, groupNameInput, groupDescInput, alert]);

  const handleDeleteGroup = useCallback(
    (group: ContactGroup) => {
      confirm(
        'Delete Group',
        `Delete "${group.name}"? Contacts in this group will not be deleted.`,
        async () => {
          try {
            await contactService.deleteGroup(group.id);
            setGroups((prev) => prev.filter((g) => g.id !== group.id));
          } catch (err: any) {
            alert('Error', err?.message || 'Failed to delete group', 'error');
          }
        },
        { confirmText: 'Delete', destructive: true, icon: 'delete-outline' },
      );
    },
    [confirm, alert],
  );

  // ── Import/Export handlers ─────────────────────────────
  const handlePickImportFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/vcard', 'text/x-vcard', 'text/csv', 'text/comma-separated-values', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const ext = (asset.name || '').toLowerCase();
      let format: 'vcard' | 'csv';
      if (ext.endsWith('.vcf') || ext.endsWith('.vcard')) {
        format = 'vcard';
      } else if (ext.endsWith('.csv')) {
        format = 'csv';
      } else {
        alert('Unsupported Format', 'Please select a .vcf (vCard) or .csv file.', 'warning');
        return;
      }
      setImportFile({ name: asset.name, uri: asset.uri, format });
    } catch (err: any) {
      alert('Error', err?.message || 'Failed to pick file', 'error');
    }
  }, [alert]);

  const handleImportContacts = useCallback(async () => {
    if (!importFile) return;
    setIsImporting(true);
    try {
      const sourceFile = new File(importFile.uri);
      const content = await sourceFile.text();
      if (!content || content.trim().length === 0) {
        alert('Empty File', 'The selected file is empty.', 'warning');
        setIsImporting(false);
        return;
      }
      let result: { imported: number; skipped: number };
      if (importFile.format === 'vcard') {
        result = await contactService.importVCard(content);
      } else {
        result = await contactService.importCsv(content);
      }
      setShowImportSheet(false);
      setImportFile(null);
      alert(
        'Import Complete',
        `Imported ${result.imported} contact${result.imported !== 1 ? 's' : ''}` +
          (result.skipped > 0 ? `, skipped ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''}` : ''),
        'success',
      );
      fetchAll(true);
    } catch (err: any) {
      alert('Import Failed', err?.message || 'Failed to import contacts', 'error');
    } finally {
      setIsImporting(false);
    }
  }, [importFile, alert, fetchAll]);

  const handleExportVCard = useCallback(async () => {
    setIsExporting(true);
    try {
      const vcardData = await contactService.exportAllVCard();
      const exportFile = new File(Paths.cache, 'contacts.vcf');
      exportFile.create();
      exportFile.write(vcardData);
      setShowExportSheet(false);
      await Sharing.shareAsync(exportFile.uri, {
        mimeType: 'text/vcard',
        dialogTitle: 'Export Contacts (vCard)',
        UTI: 'public.vcard',
      });
    } catch (err: any) {
      alert('Export Failed', err?.message || 'Failed to export contacts', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [alert]);

  const handleExportCsv = useCallback(async () => {
    setIsExporting(true);
    try {
      const csvData = await contactService.exportAllCsv();
      const exportFile = new File(Paths.cache, 'contacts.csv');
      exportFile.create();
      exportFile.write(csvData);
      setShowExportSheet(false);
      await Sharing.shareAsync(exportFile.uri, {
        mimeType: 'text/csv',
        dialogTitle: 'Export Contacts (CSV)',
      });
    } catch (err: any) {
      alert('Export Failed', err?.message || 'Failed to export contacts', 'error');
    } finally {
      setIsExporting(false);
    }
  }, [alert]);

  // ── Filter/category/tab handlers ───────────────────────
  const handleFilterChange = useCallback((tab: FilterTab) => {
    setFilter(tab);
    setSelectedCategory(null);
    setIsSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleCategorySelect = useCallback((cat: string | null) => {
    setSelectedCategory((prev) => (prev === cat ? null : cat));
  }, []);

  // ── Render: Filter tabs ─────────────────────────────────
  const renderFilterTabs = () => {
    const tabs: { key: FilterTab; label: string; count?: number }[] = [
      { key: 'all', label: 'All', count: activeContacts.length },
      { key: 'favorites', label: 'Favorites' },
      { key: 'groups', label: 'Groups', count: groups.length },
      { key: 'deleted', label: 'Deleted', count: deletedContacts.length },
    ];

    return (
      <View style={styles.filterRow}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
            onPress={() => handleFilterChange(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.filterTabText,
                filter === tab.key && styles.filterTabTextActive,
              ]}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 ? ` (${tab.count})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ── Render: Category bar ────────────────────────────────
  const renderCategoryBar = () => {
    if (categories.length === 0 || filter === 'groups' || filter === 'deleted') return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryBar}
        contentContainerStyle={styles.categoryBarContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat}
            style={[
              styles.categoryChip,
              selectedCategory === cat && styles.categoryChipActive,
            ]}
            onPress={() => handleCategorySelect(cat)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive,
              ]}
            >
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // ── Render: Toolbar (sort + select) ─────────────────────
  const renderToolbar = () => {
    if (filter === 'groups') return null;

    return (
      <View style={styles.toolbar}>
        {isSelectMode ? (
          <>
            <TouchableOpacity onPress={toggleSelectMode} style={styles.toolbarButton}>
              <Icon name="close" size={20} color={Colors.textSecondary} />
              <Text style={styles.toolbarText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.toolbarCount}>
              {selectedIds.size} selected
            </Text>
            <TouchableOpacity
              onPress={selectedIds.size === filteredContacts.length ? deselectAll : selectAll}
              style={styles.toolbarButton}
            >
              <Text style={styles.toolbarTextPrimary}>
                {selectedIds.size === filteredContacts.length ? 'Deselect all' : 'Select all'}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={() => setShowSortSheet(true)} style={styles.toolbarButton}>
              <Icon name="sort" size={18} color={Colors.textSecondary} />
              <Text style={styles.toolbarText}>
                {SORT_OPTIONS.find((s) => s.value === sortOption)?.label || 'Sort'}
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity onPress={() => setShowMoreSheet(true)} style={styles.toolbarButton}>
              <Icon name="more-vert" size={18} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSelectMode} style={[styles.toolbarButton, { marginLeft: Spacing.sm }]}>
              <Icon name="checklist" size={18} color={Colors.textSecondary} />
              <Text style={styles.toolbarText}>Select</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // ── Render: Batch action bar ────────────────────────────
  const renderBatchActions = () => {
    if (!isSelectMode || selectedIds.size === 0) return null;

    const isDeletedTab = filter === 'deleted';

    return (
      <View style={styles.batchBar}>
        {isDeletedTab ? (
          <>
            <TouchableOpacity style={styles.batchButton} onPress={handleBatchRestore}>
              <Icon name="restore" size={20} color={Colors.primary} />
              <Text style={styles.batchButtonText}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.batchButton} onPress={handleBatchHardDelete}>
              <Icon name="delete-forever" size={20} color={Colors.error} />
              <Text style={[styles.batchButtonText, { color: Colors.error }]}>Delete Forever</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.batchButton} onPress={handleBatchSoftDelete}>
              <Icon name="delete" size={20} color={Colors.error} />
              <Text style={[styles.batchButtonText, { color: Colors.error }]}>Delete</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  // ── Render: Contact row ─────────────────────────────────
  const renderContactItem = ({ item }: { item: Contact }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <TouchableOpacity
        style={[styles.contactRow, isSelected && styles.contactRowSelected]}
        onPress={() => handleContactPress(item)}
        onLongPress={() => handleContactLongPress(item)}
        activeOpacity={0.7}
      >
        {isSelectMode && (
          <Icon
            name={isSelected ? 'check-box' : 'check-box-outline-blank'}
            size={22}
            color={isSelected ? Colors.primary : Colors.textTertiary}
            style={{ marginRight: Spacing.sm }}
          />
        )}
        <Avatar name={item.displayName} imageUrl={item.photoUrl} size={44} />
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>
            {item.displayName}
          </Text>
          <Text style={styles.contactSubtitle} numberOfLines={1}>
            {[item.jobTitle, item.company].filter(Boolean).join(' at ') ||
              item.emailAddresses?.[0] ||
              ''}
          </Text>
        </View>
        {item.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryBadgeText} numberOfLines={1}>{item.category}</Text>
          </View>
        ) : null}
        {!isSelectMode && !item.isDeleted && (
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
        )}
      </TouchableOpacity>
    );
  };

  const renderSectionHeader = ({ section }: { section: ContactSection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  // ── Render: Group row ───────────────────────────────────
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
      onLongPress={() => openRenameGroup(group)}
      activeOpacity={0.7}
    >
      <View style={styles.groupIcon}>
        <Icon name="group" size={24} color={Colors.primary} />
      </View>
      <View style={styles.contactInfo}>
        <Text style={styles.contactName}>{group.name}</Text>
        {group.description ? (
          <Text style={styles.contactSubtitle} numberOfLines={1}>
            {group.description}
          </Text>
        ) : null}
      </View>
      <Text style={styles.memberCount}>{group.memberCount ?? 0}</Text>
      <Icon name="chevron-right" size={22} color={Colors.textTertiary} />
    </TouchableOpacity>
  );

  // ── Render: Sort bottom sheet ───────────────────────────
  const renderSortSheet = () => (
    <BottomSheet visible={showSortSheet} onClose={() => setShowSortSheet(false)} title="Sort by">
      {SORT_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.sortOption, sortOption === opt.value && styles.sortOptionActive]}
          onPress={() => {
            setSortOption(opt.value);
            setShowSortSheet(false);
          }}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.sortOptionText,
              sortOption === opt.value && styles.sortOptionTextActive,
            ]}
          >
            {opt.label}
          </Text>
          {sortOption === opt.value && (
            <Icon name="check" size={20} color={Colors.primary} />
          )}
        </TouchableOpacity>
      ))}
    </BottomSheet>
  );

  // ── Render: Group create/rename dialog ──────────────────
  const renderGroupDialog = () => (
    <BottomSheet
      visible={showGroupDialog}
      onClose={() => setShowGroupDialog(false)}
      title={editingGroup ? 'Rename Group' : 'New Group'}
    >
      <View style={styles.dialogContent}>
        <Text style={styles.dialogLabel}>Name</Text>
        <TextInput
          style={styles.dialogInput}
          value={groupNameInput}
          onChangeText={setGroupNameInput}
          placeholder="Group name"
          placeholderTextColor={Colors.textTertiary}
          autoFocus
        />
        <Text style={[styles.dialogLabel, { marginTop: Spacing.md }]}>Description (optional)</Text>
        <TextInput
          style={styles.dialogInput}
          value={groupDescInput}
          onChangeText={setGroupDescInput}
          placeholder="Description"
          placeholderTextColor={Colors.textTertiary}
        />
        <TouchableOpacity
          style={[styles.dialogSaveButton, isSavingGroup && { opacity: 0.6 }]}
          onPress={handleSaveGroup}
          disabled={isSavingGroup}
          activeOpacity={0.8}
        >
          {isSavingGroup ? (
            <LoadingSpinner size="small" color={Colors.textInverse} />
          ) : (
            <Text style={styles.dialogSaveText}>
              {editingGroup ? 'Update' : 'Create'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );

  // ── Main render ─────────────────────────────────────────
  if (isLoading && allContacts.length === 0) {
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
      {renderCategoryBar()}
      {renderToolbar()}

      {error && allContacts.length === 0 ? (
        <View style={styles.centered}>
          <EmptyState
            icon="error-outline"
            title="Failed to load contacts"
            subtitle={error}
          />
        </View>
      ) : filter === 'groups' ? (
        <View style={styles.groupContainer}>
          {groups.length === 0 ? (
            <View style={styles.centered}>
              <EmptyState
                icon="group"
                title="No groups"
                subtitle="Create a group to organize your contacts"
              />
            </View>
          ) : (
            <ScrollView style={styles.groupList}>
              {groups.map(renderGroupItem)}
            </ScrollView>
          )}
          <FloatingActionButton
            icon="group-add"
            onPress={openCreateGroup}
          />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
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
                icon={filter === 'deleted' ? 'delete' : 'people'}
                title={
                  filter === 'deleted'
                    ? 'No deleted contacts'
                    : filter === 'favorites'
                      ? 'No favorites'
                      : selectedCategory
                        ? `No contacts in "${selectedCategory}"`
                        : 'No contacts'
                }
                subtitle={
                  filter === 'deleted'
                    ? 'Deleted contacts will appear here'
                    : filter === 'favorites'
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
          {renderBatchActions()}
          {filter !== 'deleted' && !isSelectMode && (
            <FloatingActionButton
              icon="person-add"
              onPress={() => navigation.navigate('ContactEdit', {})}
            />
          )}
        </View>
      )}

      {renderSortSheet()}
      {renderGroupDialog()}

      {/* More actions sheet (Import / Export) */}
      <BottomSheet
        visible={showMoreSheet}
        onClose={() => setShowMoreSheet(false)}
        title="Contact Actions"
      >
        <TouchableOpacity
          style={styles.moreSheetRow}
          onPress={() => { setShowMoreSheet(false); setImportFile(null); setShowImportSheet(true); }}
          activeOpacity={0.7}
        >
          <Icon name="file-upload" size={22} color={Colors.primary} />
          <Text style={styles.moreSheetText}>Import contacts</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.moreSheetRow}
          onPress={() => { setShowMoreSheet(false); setShowExportSheet(true); }}
          activeOpacity={0.7}
        >
          <Icon name="file-download" size={22} color={Colors.primary} />
          <Text style={styles.moreSheetText}>Export contacts</Text>
        </TouchableOpacity>
      </BottomSheet>

      {/* Import contacts sheet */}
      <BottomSheet
        visible={showImportSheet}
        onClose={() => { setShowImportSheet(false); setImportFile(null); }}
        title="Import Contacts"
      >
        <View style={styles.importExportContent}>
          <Text style={styles.importDescription}>
            Select a .vcf (vCard) or .csv file to import contacts. Duplicates will be automatically detected and skipped.
          </Text>

          <TouchableOpacity
            style={styles.filePickerButton}
            onPress={handlePickImportFile}
            disabled={isImporting}
            activeOpacity={0.7}
          >
            <Icon name="attach-file" size={20} color={Colors.primary} />
            <Text style={styles.filePickerText}>
              {importFile ? importFile.name : 'Choose file (.vcf or .csv)'}
            </Text>
          </TouchableOpacity>

          {importFile && (
            <View style={styles.importFileInfo}>
              <Icon
                name={importFile.format === 'vcard' ? 'contact-page' : 'table-chart'}
                size={18}
                color={Colors.textSecondary}
              />
              <Text style={styles.importFileInfoText}>
                Format: {importFile.format === 'vcard' ? 'vCard (.vcf)' : 'CSV (.csv)'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.importExportButton,
              (!importFile || isImporting) && styles.importExportButtonDisabled,
            ]}
            onPress={handleImportContacts}
            disabled={!importFile || isImporting}
            activeOpacity={0.8}
          >
            {isImporting ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={styles.importExportButtonText}>Import</Text>
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {/* Export contacts sheet */}
      <BottomSheet
        visible={showExportSheet}
        onClose={() => setShowExportSheet(false)}
        title="Export Contacts"
      >
        <View style={styles.importExportContent}>
          <Text style={styles.importDescription}>
            Choose a format to export all your contacts.
          </Text>

          <TouchableOpacity
            style={styles.exportOptionRow}
            onPress={handleExportVCard}
            disabled={isExporting}
            activeOpacity={0.7}
          >
            <View style={styles.exportOptionIcon}>
              <Icon name="contact-page" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exportOptionTitle}>vCard (.vcf)</Text>
              <Text style={styles.exportOptionDesc}>Standard format compatible with most email clients</Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Icon name="chevron-right" size={22} color={Colors.textTertiary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.exportOptionRow}
            onPress={handleExportCsv}
            disabled={isExporting}
            activeOpacity={0.7}
          >
            <View style={styles.exportOptionIcon}>
              <Icon name="table-chart" size={24} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.exportOptionTitle}>CSV (.csv)</Text>
              <Text style={styles.exportOptionDesc}>Spreadsheet format for Excel, Google Sheets</Text>
            </View>
            {isExporting ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Icon name="chevron-right" size={22} color={Colors.textTertiary} />
            )}
          </TouchableOpacity>
        </View>
      </BottomSheet>

      {AlertComponent}
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xl,
    marginRight: Spacing.xs,
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

  // Category bar
  categoryBar: {
    maxHeight: 40,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  categoryBarContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  categoryChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  categoryChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '20',
  },
  categoryChipText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  categoryChipTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Toolbar
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  toolbarText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  toolbarTextPrimary: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },
  toolbarCount: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
  },

  // Batch actions
  batchBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  batchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  batchButtonText: {
    ...Typography.buttonSmall,
    color: Colors.primary,
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
  contactRowSelected: {
    backgroundColor: Colors.primary + '15',
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
  categoryBadge: {
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    marginRight: Spacing.sm,
    maxWidth: 80,
  },
  categoryBadgeText: {
    ...Typography.caption,
    color: Colors.primary,
    fontSize: 10,
  },

  // Group list
  groupContainer: {
    flex: 1,
  },
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

  // Sort sheet
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  sortOptionActive: {
    backgroundColor: Colors.primary + '15',
  },
  sortOptionText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  sortOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // More sheet / Import / Export
  moreSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.md,
  },
  moreSheetText: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  importExportContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  importDescription: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  filePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
  },
  filePickerText: {
    ...Typography.body,
    color: Colors.textSecondary,
    flex: 1,
  },
  importFileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  importFileInfoText: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },
  importExportButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xl,
    minHeight: 48,
  },
  importExportButtonDisabled: {
    opacity: 0.5,
  },
  importExportButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
  exportOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.md,
  },
  exportOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  exportOptionTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  exportOptionDesc: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: 2,
  },

  // Group dialog
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

export default PeopleScreen;
