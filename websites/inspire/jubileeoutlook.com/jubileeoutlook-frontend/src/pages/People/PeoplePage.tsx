import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../../context/AppContext';
import PeopleRibbon from '../../components/layout/Ribbon/PeopleRibbon';
import ContactGroups from '../../components/people/ContactGroups';
import ContactList from '../../components/people/ContactList';
import ContactDetail from '../../components/people/ContactDetail';
import ContactDialog from '../../components/people/ContactDialog';
import GroupDialog from '../../components/people/GroupDialog';
import ImportDialog from '../../components/people/ImportDialog';
import { Contact, ContactGroup, ContactDto } from '../../types/contacts';
import { contactService } from '../../services/contacts/contactService';
import './PeoplePage.css';

export type ContactSortOption = 'name-asc' | 'name-desc' | 'company-asc' | 'company-desc' | 'date-newest' | 'date-oldest';
export type FolderFilter = 'all' | 'favorites' | 'deleted' | 'lists' | string; // string = group ID

const PeoplePage: React.FC = () => {
  const { isFolderPaneVisible, setActiveModule, setComposeRequest } = useAppContext();

  // Data state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [groupMembers, setGroupMembers] = useState<Contact[]>([]);
  const [contactGroupMap, setContactGroupMap] = useState<Record<string, ContactGroup[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selection & filter state
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<ContactSortOption>('name-asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialog state
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<ContactGroup | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<string | null>(null);

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryInput, setCategoryInput] = useState('');

  // Info dialog state (for "coming soon" / "under progress" features)
  const [infoDialog, setInfoDialog] = useState<{
    icon: string;
    title: string;
    message: React.ReactNode;
  } | null>(null);

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    icon: string;
    title: string;
    message: React.ReactNode;
    confirmLabel: string;
    onConfirm: () => void;
    danger?: boolean;
  } | null>(null);

  // Fetch contacts from API
  const fetchContacts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await contactService.getContacts(1, 500);
      setContacts(result.contacts);
    } catch (err) {
      console.error('Failed to load contacts:', err);
      setError('Failed to load contacts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch groups from API
  const fetchGroups = useCallback(async () => {
    try {
      const result = await contactService.getGroups();
      setGroups(result);
      return result;
    } catch (err) {
      console.error('Failed to load contact groups:', err);
      return [];
    }
  }, []);

  // Build reverse mapping: contactId → ContactGroup[] (which groups contain this contact)
  const buildContactGroupMap = useCallback(async (groupsList: ContactGroup[]) => {
    if (groupsList.length === 0) {
      setContactGroupMap({});
      return;
    }
    const map: Record<string, ContactGroup[]> = {};
    await Promise.all(
      groupsList.map(async (group) => {
        try {
          const members = await contactService.getGroupMembers(group.id);
          for (const member of members) {
            if (!map[member.id]) map[member.id] = [];
            map[member.id].push(group);
          }
        } catch { /* skip failed group */ }
      })
    );
    setContactGroupMap(map);
  }, []);

  // Load on mount
  useEffect(() => {
    fetchContacts();
    fetchGroups().then(buildContactGroupMap);
  }, [fetchContacts, fetchGroups, buildContactGroupMap]);

  // When a group folder is selected, fetch its members
  useEffect(() => {
    if (activeFolder !== 'all' && activeFolder !== 'favorites' && activeFolder !== 'deleted' && activeFolder !== 'lists') {
      contactService.getGroupMembers(activeFolder)
        .then(setGroupMembers)
        .catch(() => setGroupMembers([]));
    } else {
      setGroupMembers([]);
    }
  }, [activeFolder]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Derive unique categories from non-deleted contacts (matches WPF UpdateCategories)
  const uniqueCategories = useMemo(() => {
    return contacts
      .filter(c => !c.isDeleted && c.category && c.category.trim() !== '')
      .map(c => c.category.trim())
      .filter((v, i, arr) => arr.indexOf(v) === i) // distinct
      .sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  // Category contact counts for sidebar display
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of uniqueCategories) {
      counts[cat] = contacts.filter(c => !c.isDeleted && c.category?.trim() === cat).length;
    }
    return counts;
  }, [contacts, uniqueCategories]);

  // Filter + sort pipeline
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Category filter takes priority (matches WPF: category overrides folder)
    if (selectedCategory) {
      result = result.filter(c => !c.isDeleted && c.category?.trim() === selectedCategory);
    } else {
      switch (activeFolder) {
        case 'all':
          result = result.filter(c => !c.isDeleted);
          break;
        case 'favorites':
          result = result.filter(c => c.isFavorite && !c.isDeleted);
          break;
        case 'deleted':
          result = result.filter(c => c.isDeleted);
          break;
        case 'lists':
          result = [];
          break;
        default: {
          const memberIds = new Set(groupMembers.map(m => m.id));
          result = result.filter(c => memberIds.has(c.id) && !c.isDeleted);
          break;
        }
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.displayName.toLowerCase().includes(q) ||
        c.emailAddresses.some(e => e.toLowerCase().includes(q)) ||
        c.company.toLowerCase().includes(q) ||
        c.phoneNumbers.some(p => p.includes(q)) ||
        c.mobilePhone.includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortOption) {
        case 'name-asc': return a.displayName.localeCompare(b.displayName);
        case 'name-desc': return b.displayName.localeCompare(a.displayName);
        case 'company-asc': return (a.company || '').localeCompare(b.company || '');
        case 'company-desc': return (b.company || '').localeCompare(a.company || '');
        case 'date-newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'date-oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default: return 0;
      }
    });

    return result;
  }, [contacts, activeFolder, selectedCategory, groupMembers, searchQuery, sortOption]);

  const selectedContact = contacts.find(c => c.id === selectedContactId) || null;

  // Refresh data after mutations
  const refreshData = useCallback(async () => {
    const [, updatedGroups] = await Promise.all([fetchContacts(), fetchGroups()]);
    await buildContactGroupMap(updatedGroups);
  }, [fetchContacts, fetchGroups, buildContactGroupMap]);

  // --- Folder handling ---

  const handleFolderSelect = (folder: FolderFilter) => {
    setActiveFolder(folder);
    setSelectedCategory(null); // Clear category when selecting a folder (matches WPF)
    setSelectedContactId(null);
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  // Category selection — toggle behavior matching WPF SelectCategory
  const handleCategorySelect = (category: string) => {
    if (selectedCategory === category) {
      // Clicking same category deselects it — revert to folder view
      setSelectedCategory(null);
    } else {
      setSelectedCategory(category);
      setActiveFolder('all'); // Clear folder selection when category is active
    }
    setSelectedContactId(null);
    setSearchQuery('');
    setSelectedIds(new Set());
  };

  // --- Multi-select ---

  const handleToggleSelect = useCallback((contactId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  }, [filteredContacts, selectedIds.size]);

  // --- Contact Dialog ---

  const handleNewContact = () => {
    setEditingContact(null);
    setContactDialogOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactDialogOpen(true);
  };

  const handleRibbonEdit = () => {
    if (selectedContact) handleEditContact(selectedContact);
  };

  const handleContactDialogSave = async (dto: Partial<ContactDto>) => {
    try {
      if (editingContact) {
        const updated = await contactService.updateContact(editingContact.id, dto);
        // Immediately update local state with the fresh contact from API
        if (updated) {
          setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
        }
      } else {
        const created = await contactService.createContact(dto);
        if (created) {
          setContacts(prev => [...prev, created]);
        }
      }
      setContactDialogOpen(false);
      setEditingContact(null);
      // Full refresh as safety net to ensure consistency
      await refreshData();
    } catch (err) {
      console.error('Failed to save contact:', err);
      setError('Failed to save contact. Please try again.');
      // Still close dialog and refresh to show whatever state the server has
      setContactDialogOpen(false);
      setEditingContact(null);
      await refreshData();
    }
  };

  const handleContactDialogClose = () => {
    setContactDialogOpen(false);
    setEditingContact(null);
  };

  // --- Group Dialog ---

  const handleNewGroup = () => {
    setEditingGroup(null);
    setGroupDialogOpen(true);
  };

  const handleEditGroup = (group: ContactGroup) => {
    setEditingGroup(group);
    setGroupDialogOpen(true);
  };

  const handleGroupDialogSave = async (name: string, description: string) => {
    try {
      if (editingGroup) {
        await contactService.updateGroup(editingGroup.id, name, description);
        setInfoDialog({
          icon: 'check_circle',
          title: 'List Updated',
          message: <>Contact list <strong>{name}</strong> has been updated.</>,
        });
      } else {
        await contactService.createGroup(name, description);
        setInfoDialog({
          icon: 'check_circle',
          title: 'List Created',
          message: <>Contact list <strong>{name}</strong> created successfully.</>,
        });
      }
      setGroupDialogOpen(false);
      setEditingGroup(null);
      await refreshData();
    } catch {
      setError(`Failed to ${editingGroup ? 'update' : 'create'} contact list.`);
    }
  };

  const handleGroupDialogClose = () => {
    setGroupDialogOpen(false);
    setEditingGroup(null);
  };

  const executeDeleteGroup = async (groupId: string) => {
    try {
      await contactService.deleteGroup(groupId);
      if (activeFolder === groupId) setActiveFolder('all');
      await refreshData();
    } catch {
      setError('Failed to delete group.');
    }
  };

  const handleDeleteGroup = (groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    setConfirmDialog({
      icon: 'delete_forever',
      title: 'Delete Contact List',
      message: <>Are you sure you want to delete the list <strong>{group?.name || 'this list'}</strong>? Contacts in this list will not be deleted.</>,
      confirmLabel: 'Delete List',
      onConfirm: () => executeDeleteGroup(groupId),
    });
  };

  // --- Delete / Restore ---

  const handleDeleteContact = async (contactId: string) => {
    try {
      if (activeFolder === 'deleted') {
        await contactService.deleteContact(contactId);
      } else {
        await contactService.softDeleteContact(contactId);
      }
      await refreshData();
      setSelectedContactId(null);
    } catch {
      setError('Failed to delete contact.');
    }
  };

  const handleRestoreContact = async (contactId: string) => {
    try {
      await contactService.restoreContact(contactId);
      await refreshData();
      setSelectedContactId(null);
    } catch {
      setError('Failed to restore contact.');
    }
  };

  const handleRibbonDelete = () => {
    if (!selectedContact) return;
    const isPermanent = activeFolder === 'deleted';
    setConfirmDialog({
      icon: 'delete_forever',
      title: isPermanent ? 'Permanently Delete Contact' : 'Delete Contact',
      message: isPermanent
        ? <>This will permanently delete <strong>{selectedContact.displayName}</strong>. This action cannot be undone.</>
        : <>Are you sure you want to delete <strong>{selectedContact.displayName}</strong>? The contact will be moved to the Deleted folder.</>,
      confirmLabel: isPermanent ? 'Delete Forever' : 'Delete',
      onConfirm: () => handleDeleteContact(selectedContact.id),
    });
  };

  const handleRibbonRestore = () => {
    if (selectedContactId) handleRestoreContact(selectedContactId);
  };

  // --- Batch operations ---

  const executeBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    try {
      await contactService.batchSoftDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
      setSelectedContactId(null);
      await refreshData();
    } catch {
      setError('Failed to delete selected contacts.');
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      icon: 'delete_forever',
      title: 'Delete Selected Contacts',
      message: <>Are you sure you want to delete <strong>{selectedIds.size} contacts</strong>? They will be moved to the Deleted folder.</>,
      confirmLabel: 'Delete All',
      onConfirm: executeBatchDelete,
    });
  };

  const executeEmptyTrash = async () => {
    const deletedContacts = contacts.filter(c => c.isDeleted);
    if (deletedContacts.length === 0) return;
    try {
      await contactService.batchHardDelete(deletedContacts.map(c => c.id));
      setSelectedContactId(null);
      await refreshData();
    } catch {
      setError('Failed to empty trash.');
    }
  };

  const handleEmptyTrash = () => {
    const deletedCount = contacts.filter(c => c.isDeleted).length;
    if (deletedCount === 0) return;
    setConfirmDialog({
      icon: 'delete_sweep',
      title: 'Empty Deleted Folder',
      message: <>This will permanently delete <strong>{deletedCount} contact{deletedCount !== 1 ? 's' : ''}</strong>. This action cannot be undone.</>,
      confirmLabel: 'Empty Trash',
      onConfirm: executeEmptyTrash,
    });
  };

  // --- Favorite ---

  const handleFavoriteToggle = async (contactId: string, isFavorite: boolean) => {
    try {
      await contactService.toggleFavorite(contactId, isFavorite);
      await refreshData();
    } catch { /* silent */ }
  };

  const handleRibbonFavorite = () => {
    if (selectedContact) {
      handleFavoriteToggle(selectedContact.id, !selectedContact.isFavorite);
    }
  };

  // --- Add to Group ---

  const handleAddToGroup = async (contactId: string, groupId: string) => {
    try {
      await contactService.addMembersToGroup(groupId, [contactId]);
      await refreshData();
    } catch {
      setError('Failed to add contact to group.');
    }
  };

  // --- Remove from Group ---

  const handleRemoveFromGroup = async (contactId: string, groupId: string) => {
    try {
      await contactService.removeMemberFromGroup(groupId, contactId);
      await refreshData();
    } catch {
      setError('Failed to remove contact from group.');
    }
  };

  // --- Import / Export ---

  const handleImport = async (file: File, format: 'vcard' | 'csv') => {
    const result = format === 'vcard'
      ? await contactService.importVCard(file)
      : await contactService.importCsv(file);
    await refreshData();
    return result;
  };

  const handleExportVCard = async () => {
    try {
      const blob = await contactService.exportVCard();
      downloadBlob(blob, 'contacts.vcf');
    } catch {
      setError('Failed to export contacts.');
    }
  };

  // --- Email (shared by ribbon + contact detail) ---
  const handleEmailContact = (contact: Contact) => {
    const email = contact.emailAddresses[0];
    if (email) {
      setComposeRequest({ to: email, toName: contact.displayName });
      setActiveModule('mail');
    } else {
      setToast('This contact has no email address.');
    }
  };

  const handleRibbonEmail = () => {
    if (selectedContact) handleEmailContact(selectedContact);
  };

  // --- Ribbon: Chat (placeholder — matches WPF) ---
  const handleRibbonChat = () => {
    setInfoDialog({
      icon: 'chat',
      title: 'Coming Soon',
      message: 'This feature is not available yet. Chat functionality is currently under development.',
    });
  };

  // --- Ribbon: Call (prefers mobile, falls back to work phone) ---
  const handleRibbonCall = () => {
    if (!selectedContact) return;
    const phone = selectedContact.mobilePhone || selectedContact.phoneNumbers[0];
    if (phone) {
      const cleaned = phone.replace(/[^\d+]/g, '');
      window.location.href = `tel:${cleaned}`;
    } else {
      setToast('This contact has no phone number.');
    }
  };

  // --- Ribbon: Share as vCard ---
  const executeShareVCard = () => {
    if (!selectedContact) return;
    const vcf = generateVCard(selectedContact);
    const blob = new Blob([vcf], { type: 'text/vcard;charset=utf-8' });
    const safeName = selectedContact.displayName.replace(/[^a-zA-Z0-9]/g, '_');
    downloadBlob(blob, `${safeName}.vcf`);
  };

  const handleRibbonShareVCard = () => {
    if (!selectedContact) return;
    setConfirmDialog({
      icon: 'share',
      title: 'Share as vCard',
      message: <>Download <strong>{selectedContact.displayName}</strong> as a vCard (.vcf) file?</>,
      confirmLabel: 'Download',
      onConfirm: executeShareVCard,
      danger: false,
    });
  };

  // --- Ribbon: Category ---
  const handleRibbonCategory = () => {
    if (!selectedContact) return;
    setCategoryInput(selectedContact.category || '');
    setCategoryDialogOpen(true);
  };

  const handleCategorySave = async () => {
    if (!selectedContact) return;
    try {
      await contactService.updateContact(selectedContact.id, { category: categoryInput.trim() } as Partial<ContactDto>);
      setCategoryDialogOpen(false);
      await refreshData();
    } catch {
      setError('Failed to update category.');
    }
  };

  return (
    <div className="people-page">
      <div className="ribbon">
        <PeopleRibbon
          onNewContact={handleNewContact}
          onNewGroup={handleNewGroup}
          onDelete={handleRibbonDelete}
          onEdit={handleRibbonEdit}
          onImport={() => setImportDialogOpen(true)}
          onExportVCard={handleExportVCard}
          onBatchDelete={handleBatchDelete}
          onFavorite={handleRibbonFavorite}
          onEmail={handleRibbonEmail}
          onChat={handleRibbonChat}
          onCall={handleRibbonCall}
          onShareVCard={handleRibbonShareVCard}
          onCategory={handleRibbonCategory}
          selectedCount={selectedIds.size}
          hasSelection={!!selectedContactId}
          isInDeletedFolder={activeFolder === 'deleted'}
          onEmptyTrash={handleEmptyTrash}
          onRestore={handleRibbonRestore}
        />
      </div>
      <div className="people-page__content">
        {isFolderPaneVisible && (
          <ContactGroups
            groups={groups}
            selectedGroupId={selectedCategory ? '' : activeFolder}
            onGroupSelect={handleFolderSelect}
            contactCounts={{
              all: contacts.filter(c => !c.isDeleted).length,
              favorites: contacts.filter(c => c.isFavorite && !c.isDeleted).length,
              deleted: contacts.filter(c => c.isDeleted).length,
            }}
            onEditGroup={handleEditGroup}
            onDeleteGroup={handleDeleteGroup}
            onEmptyTrash={handleEmptyTrash}
            onNewGroup={handleNewGroup}
            categories={uniqueCategories}
            categoryCounts={categoryCounts}
            selectedCategory={selectedCategory}
            onCategorySelect={handleCategorySelect}
          />
        )}
        <ContactList
          contacts={filteredContacts}
          selectedContactId={selectedContactId}
          onContactSelect={setSelectedContactId}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortOption={sortOption}
          onSortChange={setSortOption}
          isLoading={isLoading}
          activeFolder={activeFolder}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onRefresh={refreshData}
          onNewContact={handleNewContact}
        />
        {selectedContact && (
          <ContactDetail
            contact={selectedContact}
            groups={groups}
            memberGroups={contactGroupMap[selectedContact.id] || []}
            isInDeletedFolder={activeFolder === 'deleted'}
            onFavoriteToggle={handleFavoriteToggle}
            onEdit={handleEditContact}
            onDelete={handleDeleteContact}
            onRestore={handleRestoreContact}
            onAddToGroup={handleAddToGroup}
            onRemoveFromGroup={handleRemoveFromGroup}
            onEmail={handleEmailContact}
            onClose={() => setSelectedContactId(null)}
          />
        )}
      </div>

      <ContactDialog
        isOpen={contactDialogOpen}
        contact={editingContact}
        onClose={handleContactDialogClose}
        onSave={handleContactDialogSave}
      />

      <GroupDialog
        isOpen={groupDialogOpen}
        group={editingGroup}
        onClose={handleGroupDialogClose}
        onSave={handleGroupDialogSave}
      />

      <ImportDialog
        isOpen={importDialogOpen}
        onClose={() => { setImportDialogOpen(false); refreshData(); }}
        onImport={handleImport}
      />

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="confirm-dialog__overlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <span
              className="material-symbols-outlined confirm-dialog__icon"
              style={confirmDialog.danger === false ? { color: 'var(--gold-primary)' } : undefined}
            >
              {confirmDialog.icon}
            </span>
            <h4 className="confirm-dialog__title">{confirmDialog.title}</h4>
            <p className="confirm-dialog__message">{confirmDialog.message}</p>
            <div className="confirm-dialog__actions">
              <button
                className="confirm-dialog__btn confirm-dialog__btn--cancel"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                className={`confirm-dialog__btn ${confirmDialog.danger === false ? 'confirm-dialog__btn--save' : 'confirm-dialog__btn--confirm'}`}
                onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null); }}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Dialog (for "coming soon" / "under progress" features) */}
      {infoDialog && (
        <div className="confirm-dialog__overlay" onClick={() => setInfoDialog(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined confirm-dialog__icon" style={{ color: 'var(--gold-primary)' }}>{infoDialog.icon}</span>
            <h4 className="confirm-dialog__title">{infoDialog.title}</h4>
            <p className="confirm-dialog__message">{infoDialog.message}</p>
            <div className="confirm-dialog__actions">
              <button
                className="confirm-dialog__btn confirm-dialog__btn--save"
                onClick={() => setInfoDialog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Dialog */}
      {categoryDialogOpen && selectedContact && (
        <div className="confirm-dialog__overlay" onClick={() => setCategoryDialogOpen(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined confirm-dialog__icon" style={{ color: 'var(--gold-primary)' }}>label</span>
            <h4 className="confirm-dialog__title">Set Category</h4>
            <p className="confirm-dialog__message">
              Assign a category to <strong>{selectedContact.displayName}</strong>
            </p>
            <input
              type="text"
              className="category-dialog__input"
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              placeholder="Enter category name"
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') handleCategorySave(); }}
            />
            <div className="confirm-dialog__actions">
              <button
                className="confirm-dialog__btn confirm-dialog__btn--cancel"
                onClick={() => setCategoryDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="confirm-dialog__btn confirm-dialog__btn--save"
                onClick={handleCategorySave}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="people-page__toast">
          <span className="material-symbols-outlined">info</span>
          <span>{toast}</span>
        </div>
      )}

      {error && (
        <div className="people-page__error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button onClick={() => setError(null)}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  );
};

/** Generate vCard 3.0 string for a contact (matches WPF GenerateVCard) */
function generateVCard(contact: Contact): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${contact.lastName};${contact.firstName};${contact.middleName};;${contact.suffix}`,
    `FN:${contact.displayName}`,
  ];
  if (contact.nickname) lines.push(`NICKNAME:${contact.nickname}`);
  if (contact.company) lines.push(`ORG:${contact.company}`);
  if (contact.jobTitle) lines.push(`TITLE:${contact.jobTitle}`);
  contact.emailAddresses.forEach((email, i) => {
    lines.push(`EMAIL;TYPE=${i === 0 ? 'WORK' : 'HOME'}:${email}`);
  });
  contact.phoneNumbers.forEach((phone, i) => {
    lines.push(`TEL;TYPE=${i === 0 ? 'WORK' : 'HOME'}:${phone}`);
  });
  if (contact.mobilePhone) lines.push(`TEL;TYPE=CELL:${contact.mobilePhone}`);
  if (contact.address || contact.city || contact.state || contact.postalCode || contact.country) {
    lines.push(`ADR;TYPE=WORK:;;${contact.address};${contact.city};${contact.state};${contact.postalCode};${contact.country}`);
  }
  if (contact.website) lines.push(`URL:${contact.website}`);
  if (contact.birthday) lines.push(`BDAY:${contact.birthday}`);
  if (contact.notes) lines.push(`NOTE:${contact.notes.replace(/\n/g, '\\n')}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default PeoplePage;
