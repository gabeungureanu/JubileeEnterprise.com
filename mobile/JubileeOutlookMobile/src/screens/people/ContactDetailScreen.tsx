/**
 * ContactDetailScreen — Full detail view for a single contact.
 *
 * Features:
 * - Large avatar, name + company, category badge
 * - Quick-action buttons (Call, Email, Message) with Linking
 * - Organised detail sections for phone, email, address, work, personal, notes
 * - Group membership display with add-to-group action
 * - Soft-delete / Hard-delete / Restore actions (context-aware)
 * - Refreshes on focus (after editing)
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Share,
  Platform,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import * as Contacts from 'expo-contacts';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { Avatar, LoadingSpinner, EmptyState, BottomSheet } from '../../components/common';
import { useAlert } from '../../hooks';
import { useAuth } from '../../context/AuthContext';
import { contactService } from '../../services/contacts/contactService';
import type { Contact, ContactGroup } from '../../types/contacts';
import type { PeopleStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<PeopleStackParamList, 'ContactDetail'>;
type Route = RouteProp<PeopleStackParamList, 'ContactDetail'>;

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const ContactDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const { alert, confirm, AlertComponent } = useAlert();
  const { contactId, contact: routeContact } = route.params;

  const [contact, setContact] = useState<Contact | null>(routeContact || null);
  const [isLoading, setIsLoading] = useState(!routeContact);
  const [error, setError] = useState<string | null>(null);

  // Groups this contact belongs to
  const [contactGroups, setContactGroups] = useState<ContactGroup[]>([]);
  const [allGroups, setAllGroups] = useState<ContactGroup[]>([]);

  // Add-to-group sheet
  const [showAddGroupSheet, setShowAddGroupSheet] = useState(false);
  const [addingGroupId, setAddingGroupId] = useState<string | null>(null);

  // ── Fetch ───────────────────────────────────────────────
  const fetchContact = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await contactService.getContact(contactId);
      // API returns null for deleted contacts (includeDeleted defaults to false).
      // If we already have a valid contact from route params, keep it instead
      // of overwriting with null — this lets the Deleted tab detail view work.
      if (data) {
        setContact(data);
      } else {
        setContact((prev) => prev ?? null);
      }
    } catch (err: any) {
      // Only show error if we don't already have contact data from route params
      setContact((prev) => {
        if (!prev) setError(err?.message || 'Failed to load contact');
        return prev;
      });
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  const fetchGroups = useCallback(async () => {
    try {
      const groups = await contactService.getGroups();
      setAllGroups(groups);

      // Check which groups contain this contact
      const belongsTo: ContactGroup[] = [];
      for (const group of groups) {
        try {
          const members = await contactService.getGroupMembers(group.id);
          if (members.some((m) => m.id === contactId)) {
            belongsTo.push(group);
          }
        } catch { /* skip */ }
      }
      setContactGroups(belongsTo);
    } catch { /* ignore */ }
  }, [contactId]);

  useEffect(() => {
    if (!routeContact) fetchContact();
    fetchGroups();
  }, [routeContact, fetchContact, fetchGroups]);

  // Refresh on focus return (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      fetchContact();
      fetchGroups();
    }, [fetchContact, fetchGroups]),
  );

  // Groups not yet containing this contact
  const availableGroups = useMemo(() => {
    const memberGroupIds = new Set(contactGroups.map((g) => g.id));
    return allGroups.filter((g) => !memberGroupIds.has(g.id));
  }, [allGroups, contactGroups]);

  // ── Header actions ──────────────────────────────────────
  const handleToggleFavorite = useCallback(async () => {
    if (!contact) return;
    try {
      const newVal = !contact.isFavorite;
      setContact((prev) => (prev ? { ...prev, isFavorite: newVal } : prev));
      await contactService.toggleFavorite(contact.id, newVal);
    } catch (err: any) {
      setContact((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : prev));
      alert('Error', err?.message || 'Failed to toggle favorite', 'error');
    }
  }, [contact, alert]);

  const handleEdit = useCallback(() => {
    if (contact) {
      navigation.navigate('ContactEdit', { contactId: contact.id, contact });
    }
  }, [contact, navigation]);

  useEffect(() => {
    if (!contact) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          {!contact.isDeleted && (
            <>
              <TouchableOpacity
                onPress={handleToggleFavorite}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerButton}
              >
                <Icon
                  name={contact.isFavorite ? 'star' : 'star-border'}
                  size={22}
                  color={contact.isFavorite ? Colors.primary : Colors.textSecondary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleEdit}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.headerButton}
              >
                <Icon name="edit" size={22} color={Colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>
      ),
    });
  }, [contact, handleToggleFavorite, handleEdit, navigation]);

  // ── Quick actions ───────────────────────────────────────
  const handleCall = useCallback(() => {
    const phone = contact?.phoneNumbers?.[0] || contact?.mobilePhone;
    if (phone) {
      Linking.openURL(`tel:${phone}`).catch(() =>
        alert('Error', 'Unable to make call', 'error'),
      );
    } else {
      alert('No Phone', 'This contact has no phone number', 'warning');
    }
  }, [contact, alert]);

  const handleEmail = useCallback(() => {
    const email = contact?.emailAddresses?.[0];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      alert('No Email', 'This contact does not have a registered email', 'warning');
      return;
    }
    if (!user?.email) {
      alert('Not Signed In', 'Please sign in to send email', 'warning');
      return;
    }
    const parentNav = navigation.getParent<any>();
    if (parentNav) {
      parentNav.navigate('MailTab', {
        screen: 'Compose',
        params: { mode: 'new', to: email },
      });
    } else {
      // Fallback to native mailto if cross-tab navigation unavailable
      Linking.openURL(`mailto:${email}`).catch(() =>
        alert('Error', 'Unable to open email', 'error'),
      );
    }
  }, [contact, user, alert, navigation]);

  const handleMessage = useCallback(() => {
    const phone = contact?.mobilePhone || contact?.phoneNumbers?.[0];
    if (phone) {
      Linking.openURL(`sms:${phone}`).catch(() =>
        alert('Error', 'Unable to open messages', 'error'),
      );
    } else {
      alert('No Phone', 'This contact has no phone number', 'warning');
    }
  }, [contact, alert]);

  const handleVideoCall = useCallback(() => {
    const phone = contact?.mobilePhone || contact?.phoneNumbers?.[0];
    if (!phone) {
      alert('No Phone', 'This contact has no phone number for video call', 'warning');
      return;
    }
    if (Platform.OS === 'ios') {
      Linking.openURL(`facetime:${phone}`).catch(() =>
        alert('Unavailable', 'FaceTime is not available on this device', 'warning'),
      );
    } else {
      Linking.openURL(`https://meet.google.com/new`).catch(() =>
        alert('Unavailable', 'Unable to open video call', 'warning'),
      );
    }
  }, [contact, alert]);

  const handleShareContact = useCallback(async () => {
    if (!contact) return;
    const lines: string[] = [contact.displayName];
    if (contact.jobTitle || contact.company) {
      lines.push([contact.jobTitle, contact.company].filter(Boolean).join(' at '));
    }
    contact.phoneNumbers?.forEach((p) => lines.push(`Phone: ${p}`));
    if (contact.mobilePhone) lines.push(`Mobile: ${contact.mobilePhone}`);
    contact.emailAddresses?.forEach((e) => lines.push(`Email: ${e}`));
    if (contact.website) lines.push(`Website: ${contact.website}`);

    try {
      await Share.share({ message: lines.join('\n'), title: contact.displayName });
    } catch {
      alert('Error', 'Unable to share contact', 'error');
    }
  }, [contact, alert]);

  const handleExportVCard = useCallback(async () => {
    if (!contact) return;
    const esc = (s: string | undefined | null) => (s || '').replace(/[;,\\]/g, '\\$&');
    const lines = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:${esc(contact.lastName)};${esc(contact.firstName)};;;`,
      `FN:${esc(contact.displayName)}`,
    ];
    if (contact.company) lines.push(`ORG:${esc(contact.company)}`);
    if (contact.jobTitle) lines.push(`TITLE:${esc(contact.jobTitle)}`);
    contact.phoneNumbers?.forEach((p) => lines.push(`TEL;TYPE=WORK:${p}`));
    if (contact.mobilePhone) lines.push(`TEL;TYPE=CELL:${contact.mobilePhone}`);
    contact.emailAddresses?.forEach((e) => lines.push(`EMAIL:${e}`));
    if (contact.website) lines.push(`URL:${contact.website}`);
    if (contact.address || contact.city || contact.state || contact.postalCode || contact.country) {
      lines.push(`ADR;TYPE=WORK:;;${esc(contact.address)};${esc(contact.city)};${esc(contact.state)};${esc(contact.postalCode)};${esc(contact.country)}`);
    }
    if (contact.birthday) lines.push(`BDAY:${contact.birthday}`);
    if (contact.notes) lines.push(`NOTE:${esc(contact.notes)}`);
    lines.push('END:VCARD');

    try {
      await Share.share({ message: lines.join('\r\n'), title: `${contact.displayName}.vcf` });
    } catch {
      alert('Error', 'Unable to export contact', 'error');
    }
  }, [contact, alert]);

  const handleSaveToPhone = useCallback(async () => {
    if (!contact) return;
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Permission Denied', 'Contacts permission is required to save this contact', 'warning');
        return;
      }
      const phoneNumbers: Contacts.PhoneNumber[] = [];
      contact.phoneNumbers?.forEach((p) =>
        phoneNumbers.push({ number: p, label: 'work' } as Contacts.PhoneNumber),
      );
      if (contact.mobilePhone) {
        phoneNumbers.push({ number: contact.mobilePhone, label: 'mobile' } as Contacts.PhoneNumber);
      }
      const emails: Contacts.Email[] = contact.emailAddresses?.map(
        (e) => ({ email: e, label: 'work' }) as Contacts.Email,
      ) || [];

      const newContact: Contacts.Contact = {
        name: contact.displayName || '',
        contactType: Contacts.ContactTypes.Person,
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        company: contact.company || '',
        jobTitle: contact.jobTitle || '',
        phoneNumbers,
        emails,
        note: contact.notes || '',
      };

      await Contacts.addContactAsync(newContact);
      alert('Saved', `${contact.displayName} has been saved to your phone contacts`, 'success');
    } catch (err: any) {
      alert('Error', err?.message || 'Failed to save contact to phone', 'error');
    }
  }, [contact, alert]);

  // ── Delete / Restore actions ────────────────────────────
  const handleSoftDelete = useCallback(() => {
    if (!contact) return;
    confirm(
      'Delete Contact',
      `Move ${contact.displayName} to deleted contacts?`,
      async () => {
        try {
          await contactService.softDelete(contact.id);
          navigation.goBack();
        } catch (err: any) {
          alert('Error', err?.message || 'Failed to delete contact', 'error');
        }
      },
      { confirmText: 'Delete', destructive: true, icon: 'delete-outline' },
    );
  }, [contact, confirm, alert, navigation]);

  const handleHardDelete = useCallback(() => {
    if (!contact) return;
    confirm(
      'Permanently Delete',
      `Permanently delete ${contact.displayName}? This cannot be undone.`,
      async () => {
        try {
          await contactService.deleteContact(contact.id);
          navigation.goBack();
        } catch (err: any) {
          alert('Error', err?.message || 'Failed to delete contact', 'error');
        }
      },
      { confirmText: 'Delete Forever', destructive: true, icon: 'delete-forever' },
    );
  }, [contact, confirm, alert, navigation]);

  const handleRestore = useCallback(async () => {
    if (!contact) return;

    // Check for active duplicate before restoring (matches web frontend)
    try {
      const existingRes = await contactService.getContacts(1, 500);
      const activeContacts = existingRes.contacts.filter((c) => !c.isDeleted);
      const duplicate = contactService.findActiveDuplicate(contact, activeContacts);

      if (duplicate) {
        confirm(
          'Duplicate Contact Found',
          `An active contact "${duplicate.displayName}" already exists with the same name or email. Restore anyway?`,
          async () => {
            try {
              await contactService.restore(contact.id);
              navigation.goBack();
            } catch (err: any) {
              alert('Error', err?.message || 'Failed to restore contact', 'error');
            }
          },
          { confirmText: 'Restore Anyway', icon: 'content-copy', iconColor: Colors.warning },
        );
        return;
      }
    } catch {
      // If fetch fails, proceed with restore without duplicate check
    }

    try {
      await contactService.restore(contact.id);
      navigation.goBack();
    } catch (err: any) {
      alert('Error', err?.message || 'Failed to restore contact', 'error');
    }
  }, [contact, alert, confirm, navigation]);

  // ── Add to group ────────────────────────────────────────
  const handleAddToGroup = useCallback(
    async (group: ContactGroup) => {
      setAddingGroupId(group.id);
      try {
        await contactService.addMembersToGroup(group.id, [contactId]);
        setContactGroups((prev) => [...prev, group]);
      } catch (err: any) {
        alert('Error', err?.message || 'Failed to add to group', 'error');
      } finally {
        setAddingGroupId(null);
      }
    },
    [contactId, alert],
  );

  const handleRemoveFromGroup = useCallback(
    async (group: ContactGroup) => {
      try {
        await contactService.removeMemberFromGroup(group.id, contactId);
        setContactGroups((prev) => prev.filter((g) => g.id !== group.id));
      } catch (err: any) {
        alert('Error', err?.message || 'Failed to remove from group', 'error');
      }
    },
    [contactId, alert],
  );

  // ── Render helpers ──────────────────────────────────────
  const renderDetailSection = (
    title: string,
    items: { icon: string; label: string; value: string; onPress?: () => void }[],
  ) => {
    const nonEmpty = items.filter((i) => !!i.value);
    if (nonEmpty.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {nonEmpty.map((item, idx) => (
          <TouchableOpacity
            key={`${title}-${idx}`}
            style={styles.detailItem}
            onPress={item.onPress}
            disabled={!item.onPress}
            activeOpacity={item.onPress ? 0.7 : 1}
          >
            <Icon name={item.icon as any} size={20} color={Colors.textSecondary} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>{item.label}</Text>
              <Text style={[styles.detailValue, item.onPress && styles.detailValueLink]}>
                {item.value}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  // ── Main render ─────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error || !contact) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon="error-outline"
          title="Contact not found"
          subtitle={error || 'Unable to load contact details'}
        />
      </View>
    );
  }

  const fullAddress = [contact.address, contact.city, contact.state, contact.postalCode, contact.country]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Deleted banner */}
        {contact.isDeleted && (
          <View style={styles.deletedBanner}>
            <Icon name="delete" size={18} color={Colors.error} />
            <Text style={styles.deletedBannerText}>This contact is in the deleted folder</Text>
          </View>
        )}

        {/* Avatar & name */}
        <View style={styles.profileSection}>
          <Avatar name={contact.displayName} imageUrl={contact.photoUrl} size={80} />
          <Text style={styles.profileName}>{contact.displayName}</Text>
          {(contact.company || contact.jobTitle) && (
            <Text style={styles.profileSubtitle}>
              {[contact.jobTitle, contact.company].filter(Boolean).join(' at ')}
            </Text>
          )}
          {/* Category badge */}
          {!!contact.category && (
            <View style={styles.profileCategoryBadge}>
              <Text style={styles.profileCategoryText}>{contact.category}</Text>
            </View>
          )}
        </View>

        {/* Quick action buttons */}
        {!contact.isDeleted && (
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
              <View style={styles.actionIcon}>
                <Icon name="phone" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleEmail}>
              <View style={styles.actionIcon}>
                <Icon name="email" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
              <View style={styles.actionIcon}>
                <Icon name="message" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleVideoCall}>
              <View style={styles.actionIcon}>
                <Icon name="videocam" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Video</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleShareContact}>
              <View style={styles.actionIcon}>
                <Icon name="share" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleExportVCard}>
              <View style={styles.actionIcon}>
                <Icon name="file-download" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Export</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleSaveToPhone}>
              <View style={styles.actionIcon}>
                <Icon name="contact-phone" size={22} color={Colors.primary} />
              </View>
              <Text style={styles.actionLabel}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Restore / Delete actions for deleted contacts */}
        {contact.isDeleted && (
          <View style={styles.deletedActions}>
            <TouchableOpacity style={styles.restoreButton} onPress={handleRestore}>
              <Icon name="restore" size={20} color={Colors.primary} />
              <Text style={styles.restoreButtonText}>Restore Contact</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.hardDeleteButton} onPress={handleHardDelete}>
              <Icon name="delete-forever" size={20} color={Colors.error} />
              <Text style={styles.hardDeleteButtonText}>Delete Permanently</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Group membership */}
        {!contact.isDeleted && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>GROUPS</Text>
              <TouchableOpacity
                onPress={() => setShowAddGroupSheet(true)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="add" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            {contactGroups.length === 0 ? (
              <Text style={styles.noGroupsText}>Not in any group</Text>
            ) : (
              <View style={styles.groupChips}>
                {contactGroups.map((g) => (
                  <View key={g.id} style={styles.groupChip}>
                    <Icon name="group" size={14} color={Colors.primary} />
                    <Text style={styles.groupChipText}>{g.name}</Text>
                    <TouchableOpacity
                      onPress={() => handleRemoveFromGroup(g)}
                      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
                    >
                      <Icon name="close" size={14} color={Colors.textTertiary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Phone numbers */}
        {renderDetailSection('Phone', [
          ...(contact.phoneNumbers || []).map((p, i) => ({
            icon: 'phone',
            label: i === 0 ? 'Primary' : `Phone ${i + 1}`,
            value: p,
            onPress: () => Linking.openURL(`tel:${p}`).catch(() => {}),
          })),
          ...(contact.mobilePhone
            ? [{
                icon: 'smartphone',
                label: 'Mobile',
                value: contact.mobilePhone,
                onPress: () => Linking.openURL(`tel:${contact.mobilePhone}`).catch(() => {}),
              }]
            : []),
        ])}

        {/* Email addresses */}
        {renderDetailSection(
          'Email',
          (contact.emailAddresses || []).map((e, i) => ({
            icon: 'email',
            label: i === 0 ? 'Primary' : `Email ${i + 1}`,
            value: e,
            onPress: () => Linking.openURL(`mailto:${e}`).catch(() => {}),
          })),
        )}

        {/* Address */}
        {renderDetailSection('Address', [
          {
            icon: 'place',
            label: 'Address',
            value: fullAddress,
            onPress: fullAddress
              ? () => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(fullAddress)}`).catch(() => {})
              : undefined,
          },
        ])}

        {/* Work info */}
        {renderDetailSection('Work', [
          { icon: 'business', label: 'Company', value: contact.company || '' },
          { icon: 'work', label: 'Job Title', value: contact.jobTitle || '' },
          { icon: 'apartment', label: 'Department', value: contact.department || '' },
          { icon: 'meeting-room', label: 'Office', value: contact.office || '' },
        ])}

        {/* Personal info */}
        {renderDetailSection('Personal', [
          { icon: 'cake', label: 'Birthday', value: contact.birthday || '' },
          { icon: 'favorite', label: 'Anniversary', value: contact.anniversary || '' },
          { icon: 'people', label: 'Spouse', value: contact.spouse || '' },
          {
            icon: 'language',
            label: 'Website',
            value: contact.website || '',
            onPress: contact.website
              ? () => Linking.openURL(contact.website.startsWith('http') ? contact.website : `https://${contact.website}`).catch(() => {})
              : undefined,
          },
        ])}

        {/* Notes */}
        {!!contact.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>NOTES</Text>
            <Text style={styles.notesText}>{contact.notes}</Text>
          </View>
        )}

        {/* Delete action (for active contacts) */}
        {!contact.isDeleted && (
          <TouchableOpacity style={styles.softDeleteButton} onPress={handleSoftDelete}>
            <Icon name="delete" size={20} color={Colors.error} />
            <Text style={styles.softDeleteButtonText}>Delete Contact</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Add-to-group bottom sheet */}
      <BottomSheet
        visible={showAddGroupSheet}
        onClose={() => setShowAddGroupSheet(false)}
        title="Add to Group"
      >
        {availableGroups.length === 0 ? (
          <View style={styles.addGroupEmpty}>
            <Text style={styles.addGroupEmptyText}>
              {allGroups.length === 0
                ? 'No groups created yet'
                : 'Already in all groups'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={availableGroups}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isAdding = addingGroupId === item.id;
              return (
                <TouchableOpacity
                  style={styles.addGroupRow}
                  onPress={() => handleAddToGroup(item)}
                  disabled={isAdding}
                  activeOpacity={0.7}
                >
                  <View style={styles.addGroupIcon}>
                    <Icon name="group" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.addGroupName}>{item.name}</Text>
                  {isAdding ? (
                    <LoadingSpinner size="small" />
                  ) : (
                    <Icon name="add" size={22} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </BottomSheet>

      {AlertComponent}
    </>
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
  content: {
    paddingBottom: Spacing.xxxxl,
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

  // Deleted banner
  deletedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.error + '15',
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  deletedBannerText: {
    ...Typography.bodySmall,
    color: Colors.error,
  },

  // Profile section
  profileSection: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  profileName: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  profileSubtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  profileCategoryBadge: {
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginTop: Spacing.sm,
  },
  profileCategoryText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    width: 68,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  actionLabel: {
    ...Typography.caption,
    color: Colors.textSecondary,
  },

  // Deleted contact actions
  deletedActions: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  restoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  restoreButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
  hardDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  hardDeleteButtonText: {
    ...Typography.button,
    color: Colors.error,
  },

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Group chips
  noGroupsText: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  groupChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
  },
  groupChipText: {
    ...Typography.bodySmall,
    color: Colors.textPrimary,
  },

  // Detail items
  detailItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  detailText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  detailLabel: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  detailValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  detailValueLink: {
    color: Colors.primary,
  },

  // Notes
  notesText: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 22,
  },

  // Soft delete button
  softDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    gap: Spacing.sm,
  },
  softDeleteButtonText: {
    ...Typography.button,
    color: Colors.error,
  },

  // Add to group sheet
  addGroupEmpty: {
    padding: Spacing.xxl,
    alignItems: 'center',
  },
  addGroupEmptyText: {
    ...Typography.body,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  addGroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  addGroupIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  addGroupName: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
  },
});

export default ContactDetailScreen;
