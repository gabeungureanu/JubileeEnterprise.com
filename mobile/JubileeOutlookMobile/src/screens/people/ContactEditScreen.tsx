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
import { LoadingSpinner, BottomSheet } from '../../components/common';
import { MonthGrid } from '../../components/modules/calendar/MonthGrid';
import { useAlert } from '../../hooks';
import { contactService } from '../../services/contacts/contactService';
import type { ContactDto } from '../../types/contacts';
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

  // ── Two-pass duplicate check state (matches web frontend) ──
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{ displayName: string; email?: string }[]>([]);

  // ── Date picker state ────────────────────────────────────
  const [datePickerTarget, setDatePickerTarget] = useState<'birthday' | 'anniversary' | null>(null);
  const [browseYear, setBrowseYear] = useState(new Date().getFullYear());
  const [browseMonth, setBrowseMonth] = useState(new Date().getMonth());

  // ── Navigation title ────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Contact' : 'New Contact',
    });
  }, [isEditing, navigation]);

  // ── Save with two-pass duplicate check (matches web frontend exactly) ──
  const handleSave = useCallback(async () => {
    const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

    if (!displayName) {
      alert('Validation', 'A name is required (first or last name)', 'warning');
      return;
    }

    // Validate website URL if provided (matches web frontend)
    if (website.trim()) {
      try {
        const urlToTest = /^https?:\/\//i.test(website.trim())
          ? website.trim()
          : `https://${website.trim()}`;
        new URL(urlToTest);
      } catch {
        alert('Validation', 'Invalid website URL. Please enter a valid URL (e.g., https://www.example.com).', 'warning');
        return;
      }
    }

    setIsSaving(true);
    try {
      // Build payload with snake_case keys matching ContactDto / web frontend's ContactDialog
      const payload: Partial<ContactDto> = {
        display_name: displayName,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        email_addresses: email.trim() ? [email.trim()] : undefined,
        phone_numbers: phone.trim() ? [phone.trim()] : undefined,
        mobile_phone: mobilePhone.trim() || undefined,
        company: company.trim() || undefined,
        job_title: jobTitle.trim() || undefined,
        department: department.trim() || undefined,
        office: office.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim() || undefined,
        postal_code: postalCode.trim() || undefined,
        country: country.trim() || undefined,
        notes: notes.trim() || undefined,
        website: website.trim() || undefined,
        birthday: birthday.trim() || null,
        anniversary: anniversary.trim() || null,
        spouse: spouse.trim() || undefined,
        category: category.trim() || undefined,
      };

      if (isEditing && contactId) {
        // Editing existing — no duplicate check needed
        await contactService.updateContact(contactId, payload);
        navigation.goBack();
      } else {
        // Creating new — two-pass duplicate check (matches web PeoplePage exactly)
        if (!duplicateChecked) {
          // FIRST PASS: check for duplicates before saving
          try {
            const phoneNumbers = phone.trim() ? [phone.trim()] : [];
            const dupes = await contactService.checkDuplicates(
              displayName,
              phoneNumbers,
              mobilePhone.trim() || undefined,
            );

            if (dupes.length > 0) {
              // Show warning and require second click
              setDuplicateWarning(
                dupes.map((d) => ({
                  displayName: d.displayName,
                  email: d.emailAddresses?.[0],
                })),
              );
              setDuplicateChecked(true);
              setIsSaving(false);
              return;
            }
          } catch {
            // If check-duplicates endpoint fails, proceed with create
          }
        }

        // SECOND PASS (or no dupes found): proceed to create
        // If duplicateChecked is true, user confirmed by clicking Save again
        if (duplicateChecked) {
          (payload as any).skip_duplicate_check = true;
        }
        await contactService.createContact(payload);
        navigation.goBack();
      }
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
          { confirmText: 'Restore', icon: 'restore', iconColor: Colors.success }
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
    isEditing, contactId, navigation, alert, confirm, duplicateChecked,
  ]);

  // Reset duplicate check state when form fields change
  useEffect(() => {
    if (duplicateChecked) {
      setDuplicateChecked(false);
      setDuplicateWarning([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstName, lastName, phone, mobilePhone, email]);

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
      { confirmText: 'Delete', destructive: true, icon: 'delete-outline' },
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

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const openDatePicker = useCallback((target: 'birthday' | 'anniversary') => {
    const current = target === 'birthday' ? birthday : anniversary;
    const d = current ? new Date(current) : new Date();
    const valid = !isNaN(d.getTime());
    setBrowseYear(valid ? d.getFullYear() : new Date().getFullYear());
    setBrowseMonth(valid ? d.getMonth() : new Date().getMonth());
    setDatePickerTarget(target);
  }, [birthday, anniversary]);

  const handleDateSelect = useCallback((selected: Date) => {
    const iso = selected.toISOString().split('T')[0]; // YYYY-MM-DD
    if (datePickerTarget === 'birthday') setBirthday(iso);
    else if (datePickerTarget === 'anniversary') setAnniversary(iso);
    setDatePickerTarget(null);
  }, [datePickerTarget]);

  const formatDateDisplay = (value: string): string => {
    if (!value) return '';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const renderDateField = (
    label: string,
    value: string,
    target: 'birthday' | 'anniversary',
  ) => (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.optionalText}>Optional</Text>
      </View>
      <TouchableOpacity
        style={styles.dateField}
        onPress={() => openDatePicker(target)}
        activeOpacity={0.7}
      >
        <Icon name="calendar-today" size={18} color={Colors.textSecondary} />
        <Text style={[styles.dateFieldText, !value && styles.dateFieldPlaceholder]}>
          {value ? formatDateDisplay(value) : `Select ${label.toLowerCase()}`}
        </Text>
        {value ? (
          <TouchableOpacity
            onPress={() => {
              if (target === 'birthday') setBirthday('');
              else setAnniversary('');
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close" size={18} color={Colors.textTertiary} />
          </TouchableOpacity>
        ) : (
          <Icon name="expand-more" size={20} color={Colors.textTertiary} />
        )}
      </TouchableOpacity>
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
        {renderField('Phone', phone, setPhone, { keyboardType: 'phone-pad' })}
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
        {renderDateField('Birthday', birthday, 'birthday')}
        {renderDateField('Anniversary', anniversary, 'anniversary')}
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

        {/* Duplicate warning (shown on first save if duplicates found) */}
        {duplicateWarning.length > 0 && (
          <View style={styles.duplicateWarning}>
            <View style={styles.duplicateWarningHeader}>
              <Icon name="warning" size={20} color="#E8A317" />
              <Text style={styles.duplicateWarningTitle}>Possible duplicates found</Text>
            </View>
            {duplicateWarning.map((d, idx) => (
              <Text key={idx} style={styles.duplicateWarningItem}>
                {d.displayName}{d.email ? ` (${d.email})` : ''}
              </Text>
            ))}
            <Text style={styles.duplicateWarningHint}>
              Click Save again to create anyway.
            </Text>
          </View>
        )}

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

      {/* Date picker bottom sheet */}
      <BottomSheet
        visible={!!datePickerTarget}
        onClose={() => setDatePickerTarget(null)}
        title={`Select ${datePickerTarget === 'birthday' ? 'Birthday' : 'Anniversary'}`}
        maxHeight="70%"
      >
        <View style={styles.sheetNav}>
          <TouchableOpacity
            onPress={() => {
              if (browseMonth === 0) { setBrowseYear(y => y - 1); setBrowseMonth(11); }
              else setBrowseMonth(m => m - 1);
            }}
            style={styles.sheetNavBtn}
          >
            <Icon name="chevron-left" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.sheetNavTitle}>
            {MONTH_NAMES[browseMonth]} {browseYear}
          </Text>
          <TouchableOpacity
            onPress={() => {
              if (browseMonth === 11) { setBrowseYear(y => y + 1); setBrowseMonth(0); }
              else setBrowseMonth(m => m + 1);
            }}
            style={styles.sheetNavBtn}
          >
            <Icon name="chevron-right" size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <MonthGrid
          currentYear={browseYear}
          currentMonth={browseMonth}
          selectedDate={
            (() => {
              const val = datePickerTarget === 'birthday' ? birthday : anniversary;
              const d = val ? new Date(val) : null;
              return d && !isNaN(d.getTime()) ? d : new Date();
            })()
          }
          events={[]}
          onDateSelect={handleDateSelect}
          expanded
        />
      </BottomSheet>
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

  // Date picker field
  dateField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  dateFieldText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  dateFieldPlaceholder: {
    color: Colors.textTertiary,
  },

  // Date picker sheet
  sheetNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  sheetNavBtn: {
    padding: Spacing.xs,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetNavTitle: {
    ...Typography.label,
    color: Colors.textPrimary,
  },

  // Duplicate warning
  duplicateWarning: {
    backgroundColor: 'rgba(232, 163, 23, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232, 163, 23, 0.3)',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.xl,
  },
  duplicateWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  duplicateWarningTitle: {
    ...Typography.body,
    color: '#E8A317',
    fontWeight: '600',
  },
  duplicateWarningItem: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    paddingLeft: Spacing.lg + Spacing.sm,
    paddingVertical: 2,
  },
  duplicateWarningHint: {
    ...Typography.caption,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.sm,
    paddingLeft: Spacing.lg + Spacing.sm,
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
