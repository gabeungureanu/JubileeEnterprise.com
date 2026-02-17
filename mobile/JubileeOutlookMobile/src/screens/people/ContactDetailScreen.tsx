/**
 * ContactDetailScreen — Full detail view for a single contact.
 *
 * Displays a large avatar, name and company, quick-action buttons
 * (Call, Email, Message), and organised detail sections for phone,
 * email, address, work info, personal info, and notes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { Avatar, LoadingSpinner, EmptyState } from '../../components/common';
import { contactService } from '../../services/contacts/contactService';
import type { Contact } from '../../types/contacts';
import type { PeopleStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<PeopleStackParamList, 'ContactDetail'>;
type Route = RouteProp<PeopleStackParamList, 'ContactDetail'>;

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const ContactDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { contactId, contact: routeContact } = route.params;

  const [contact, setContact] = useState<Contact | null>(routeContact || null);
  const [isLoading, setIsLoading] = useState(!routeContact);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch ─────────────────────────────────────────────────

  const fetchContact = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await contactService.getContact(contactId);
      setContact(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load contact');
    } finally {
      setIsLoading(false);
    }
  }, [contactId]);

  useEffect(() => {
    if (!routeContact) {
      fetchContact();
    }
  }, [routeContact, fetchContact]);

  // ── Header actions ────────────────────────────────────────

  const handleToggleFavorite = useCallback(async () => {
    if (!contact) return;
    try {
      await contactService.toggleFavorite(contact.id);
      setContact((prev) =>
        prev ? { ...prev, isFavorite: !prev.isFavorite } : prev,
      );
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to toggle favorite');
    }
  }, [contact]);

  const handleEdit = useCallback(() => {
    if (contact) {
      navigation.navigate('ContactEdit', {
        contactId: contact.id,
        contact,
      });
    }
  }, [contact, navigation]);

  useEffect(() => {
    if (!contact) return;
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
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
        </View>
      ),
    });
  }, [contact, handleToggleFavorite, handleEdit, navigation]);

  // ── Quick actions ─────────────────────────────────────────

  const handleCall = useCallback(() => {
    const phone = contact?.phoneNumbers?.[0] || contact?.mobilePhone;
    if (phone) {
      Alert.alert('Call', `Calling ${phone}`);
    } else {
      Alert.alert('No Phone', 'This contact has no phone number');
    }
  }, [contact]);

  const handleEmail = useCallback(() => {
    const email = contact?.emailAddresses?.[0];
    if (email) {
      Alert.alert('Email', `Composing email to ${email}`);
    } else {
      Alert.alert('No Email', 'This contact has no email address');
    }
  }, [contact]);

  const handleMessage = useCallback(() => {
    const phone = contact?.mobilePhone || contact?.phoneNumbers?.[0];
    if (phone) {
      Alert.alert('Message', `Messaging ${phone}`);
    } else {
      Alert.alert('No Phone', 'This contact has no phone number');
    }
  }, [contact]);

  // ── Render helpers ────────────────────────────────────────

  const renderDetailSection = (
    title: string,
    items: { icon: string; label: string; value: string }[],
  ) => {
    const nonEmpty = items.filter((i) => !!i.value);
    if (nonEmpty.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {nonEmpty.map((item, idx) => (
          <View key={`${title}-${idx}`} style={styles.detailItem}>
            <Icon name={item.icon} size={20} color={Colors.textSecondary} />
            <View style={styles.detailText}>
              <Text style={styles.detailLabel}>{item.label}</Text>
              <Text style={styles.detailValue}>{item.value}</Text>
            </View>
          </View>
        ))}
      </View>
    );
  };

  // ── Main render ───────────────────────────────────────────

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
          message={error || 'Unable to load contact details'}
        />
      </View>
    );
  }

  const fullAddress = [contact.address, contact.city, contact.state, contact.postalCode, contact.country]
    .filter(Boolean)
    .join(', ');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar & name */}
      <View style={styles.profileSection}>
        <Avatar
          name={contact.displayName}
          photoUrl={contact.photoUrl}
          size={80}
        />
        <Text style={styles.profileName}>{contact.displayName}</Text>
        {(contact.company || contact.jobTitle) && (
          <Text style={styles.profileSubtitle}>
            {[contact.jobTitle, contact.company].filter(Boolean).join(' at ')}
          </Text>
        )}
      </View>

      {/* Quick action buttons */}
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
      </View>

      {/* Phone numbers */}
      {renderDetailSection('Phone', [
        ...(contact.phoneNumbers || []).map((p, i) => ({
          icon: 'phone',
          label: i === 0 ? 'Primary' : `Phone ${i + 1}`,
          value: p,
        })),
        ...(contact.mobilePhone
          ? [{ icon: 'smartphone', label: 'Mobile', value: contact.mobilePhone }]
          : []),
      ])}

      {/* Email addresses */}
      {renderDetailSection(
        'Email',
        (contact.emailAddresses || []).map((e, i) => ({
          icon: 'email',
          label: i === 0 ? 'Primary' : `Email ${i + 1}`,
          value: e,
        })),
      )}

      {/* Address */}
      {renderDetailSection('Address', [
        { icon: 'place', label: 'Address', value: fullAddress },
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
        { icon: 'language', label: 'Website', value: contact.website || '' },
      ])}

      {/* Notes */}
      {!!contact.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notesText}>{contact.notes}</Text>
        </View>
      )}
    </ScrollView>
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

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  actionButton: {
    alignItems: 'center',
    marginHorizontal: Spacing.xxl,
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

  // Sections
  section: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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

  // Notes
  notesText: {
    ...Typography.body,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
});

export default ContactDetailScreen;
