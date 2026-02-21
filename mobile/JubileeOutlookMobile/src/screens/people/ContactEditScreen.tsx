/**
 * ContactEditScreen — Create or edit a contact.
 *
 * Full form with all contact fields matching web frontend parity:
 * name, contact info, work, address, personal (birthday, anniversary, spouse),
 * category, and notes. Validates displayName, handles create + edit + delete.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner } from '../../components/common';
import { useAlert } from '../../hooks';
import { contactService } from '../../services/contacts/contactService';
import { tokenStore } from '../../services/apiClient';
import type { CreateContactPayload } from '../../types/contacts';
import type { PeopleStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<PeopleStackParamList, 'ContactEdit'>;
type Route = RouteProp<PeopleStackParamList, 'ContactEdit'>;

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const ContactEditScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { contactId, contact: existingContact } = route.params || {};

  const { alert, confirm, AlertComponent } = useAlert();
  const isEditing = !!contactId;

  // ── Form state ──────────────────────────────────────────
  const [firstName, setFirstName] = useState(existingContact?.firstName || '');
  const [lastName, setLastName] = useState(existingContact?.lastName || '');
  const [email, setEmail] = useState(existingContact?.emailAddresses?.[0] || '');
  const [phone, setPhone] = useState(existingContact?.phoneNumbers?.[0] || '');
  const [mobilePhone, setMobilePhone] = useState(existingContact?.mobilePhone || '');
  const [company, setCompany] = useState(existingContact?.company || '');
  const [jobTitle, setJobTitle] = useState(existingContact?.jobTitle || '');
  const [department, setDepartment] = useState(existingContact?.department || '');
  const [office, setOffice] = useState(existingContact?.office || '');
  const [address, setAddress] = useState(existingContact?.address || '');
  const [city, setCity] = useState(existingContact?.city || '');
  const [state, setState] = useState(existingContact?.state || '');
  const [postalCode, setPostalCode] = useState(existingContact?.postalCode || '');
  const [country, setCountry] = useState(existingContact?.country || '');
  const [notes, setNotes] = useState(existingContact?.notes || '');
  const [website, setWebsite] = useState(existingContact?.website || '');
  const [birthday, setBirthday] = useState(existingContact?.birthday || '');
  const [anniversary, setAnniversary] = useState(existingContact?.anniversary || '');
  const [spouse, setSpouse] = useState(existingContact?.spouse || '');
  const [category, setCategory] = useState(existingContact?.category || '');
  const [isSaving, setIsSaving] = useState(false);

  // ── Navigation title ────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Contact' : 'New Contact',
    });
  }, [isEditing, navigation]);

  // ── Save ────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

    if (!displayName) {
      alert('Validation', 'A name is required (first or last name)', 'warning');
      return;
    }

    if (!phone.trim() && !mobilePhone.trim()) {
      alert('Validation', 'At least one phone number is required (phone or mobile)', 'warning');
      return;
    }

    const userId = tokenStore.getUserId();
    if (!userId) {
      alert('Error', 'User not authenticated', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload: CreateContactPayload & { office?: string; spouse?: string } = {
        userId,
        displayName,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        emailAddresses: email.trim() ? [email.trim()] : undefined,
        phoneNumbers: phone.trim() ? [phone.trim()] : undefined,
        mobilePhone: mobilePhone.trim() || undefined,
        company: company.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        department: department.trim() || undefined,
        office: office.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        notes: notes.trim() || undefined,
        website: website.trim() || undefined,
        birthday: birthday.trim() || undefined,
        anniversary: anniversary.trim() || undefined,
        spouse: spouse.trim() || undefined,
        category: category.trim() || undefined,
      };

      if (isEditing && contactId) {
        await contactService.updateContact(contactId, payload);
      } else {
        await contactService.createContact(payload);
      }

      navigation.goBack();
    } catch (err: any) {
      if (err?.code === 'DELETED_DUPLICATE_FOUND' && err?.deletedContactId) {
        // Offer to restore the deleted duplicate
        const deletedId = err.deletedContactId;
        confirm(
          'Deleted Contact Found',
          `A deleted contact with the same name and phone number already exists. Would you like to restore it instead?`,
          async () => {
            try {
              await contactService.restore(deletedId);
              navigation.goBack();
            } catch {
              alert('Error', 'Failed to restore contact.', 'error');
            }
          },
          { confirmText: 'Restore' }
        );
      } else {
        alert('Error', err?.message || 'Failed to save contact', 'error');
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    firstName, lastName, email, phone, mobilePhone, company, jobTitle,
    department, office, address, city, state, postalCode, country,
    notes, website, birthday, anniversary, spouse, category,
    isEditing, contactId, navigation, alert, confirm,
  ]);

  // ── Delete ──────────────────────────────────────────────
  const handleDelete = useCallback(() => {
    if (!contactId) return;
    confirm(
      'Delete Contact',
      'Move this contact to deleted contacts?',
      async () => {
        try {
          await contactService.softDelete(contactId);
          navigation.goBack();
        } catch (err: any) {
          alert('Error', err?.message || 'Failed to delete contact', 'error');
        }
      },
      { confirmText: 'Delete', destructive: true },
    );
  }, [contactId, navigation, confirm, alert]);

  // ── Render helpers ──────────────────────────────────────
  const renderField = (
    label: string,
    value: string,
    onChangeText: (t: string) => void,
    options?: {
      placeholder?: string;
      keyboardType?: 'default' | 'email-address' | 'phone-pad';
      autoCapitalize?: 'none' | 'sentences' | 'words';
      multiline?: boolean;
      isRequired?: boolean;
    },
  ) => (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {!options?.isRequired && (
          <Text style={styles.optionalText}>Optional</Text>
        )}
      </View>
      <TextInput
        style={[styles.textInput, options?.multiline && styles.multilineInput]}
        value={value}
        onChangeText={onChangeText}
        placeholder={options?.placeholder || `Enter ${label.toLowerCase()}`}
        placeholderTextColor={Colors.textTertiary}
        keyboardType={options?.keyboardType || 'default'}
        autoCapitalize={options?.autoCapitalize ?? 'words'}
        multiline={options?.multiline}
        numberOfLines={options?.multiline ? 4 : 1}
        textAlignVertical={options?.multiline ? 'top' : 'center'}
      />
    </View>
  );

  // ── Main render ─────────────────────────────────────────
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Name section */}
        <Text style={styles.sectionTitle}>Name</Text>
        {renderField('First Name', firstName, setFirstName, { isRequired: true })}
        {renderField('Last Name', lastName, setLastName, { isRequired: true })}

        {/* Contact info */}
        <Text style={styles.sectionTitle}>Contact Info</Text>
        {renderField('Email', email, setEmail, {
          keyboardType: 'email-address',
          autoCapitalize: 'none',
        })}
        {renderField('Phone', phone, setPhone, { keyboardType: 'phone-pad', isRequired: true })}
        {renderField('Mobile', mobilePhone, setMobilePhone, {
          keyboardType: 'phone-pad',
        })}
        {renderField('Website', website, setWebsite, { autoCapitalize: 'none' })}

        {/* Work info */}
        <Text style={styles.sectionTitle}>Work</Text>
        {renderField('Company', company, setCompany)}
        {renderField('Job Title', jobTitle, setJobTitle)}
        {renderField('Department', department, setDepartment)}
        {renderField('Office', office, setOffice)}

        {/* Address */}
        <Text style={styles.sectionTitle}>Address</Text>
        {renderField('Street', address, setAddress)}
        {renderField('City', city, setCity)}
        {renderField('State / Province', state, setState)}
        {renderField('Postal Code', postalCode, setPostalCode)}
        {renderField('Country', country, setCountry)}

        {/* Personal */}
        <Text style={styles.sectionTitle}>Personal</Text>
        {renderField('Birthday', birthday, setBirthday, {
          placeholder: 'YYYY-MM-DD',
          autoCapitalize: 'none',
        })}
        {renderField('Anniversary', anniversary, setAnniversary, {
          placeholder: 'YYYY-MM-DD',
          autoCapitalize: 'none',
        })}
        {renderField('Spouse / Partner', spouse, setSpouse)}

        {/* Category */}
        <Text style={styles.sectionTitle}>Category</Text>
        {renderField('Category', category, setCategory, {
          placeholder: 'e.g. Work, Family, Friends',
        })}

        {/* Notes */}
        <Text style={styles.sectionTitle}>Notes</Text>
        {renderField('Notes', notes, setNotes, {
          multiline: true,
          placeholder: 'Add notes',
          autoCapitalize: 'sentences',
        })}

        {/* Delete button */}
        {isEditing && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDelete}
            activeOpacity={0.7}
          >
            <Icon name="delete" size={20} color={Colors.error} />
            <Text style={styles.deleteButtonText}>Delete Contact</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Save button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <LoadingSpinner size="small" color={Colors.textInverse} />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Update Contact' : 'Create Contact'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xxxl,
  },

  // Section titles
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Fields
  field: {
    marginBottom: Spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  optionalText: {
    fontSize: 11,
    color: Colors.textTertiary,
    opacity: 0.7,
    fontStyle: 'italic',
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Colors.textPrimary,
    ...Typography.body,
  },
  multilineInput: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },

  // Delete button
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  deleteButtonText: {
    ...Typography.button,
    color: Colors.error,
    marginLeft: Spacing.sm,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.surface,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});

export default ContactEditScreen;
