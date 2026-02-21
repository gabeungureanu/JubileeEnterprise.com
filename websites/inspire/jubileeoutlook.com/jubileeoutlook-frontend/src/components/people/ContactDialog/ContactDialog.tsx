import React, { useState, useEffect, useRef } from 'react';
import { Contact, ContactDto } from '../../../types/contacts';
import { contactService } from '../../../services/contacts/contactService';
import './ContactDialog.css';

type TabId = 'contact' | 'work' | 'address' | 'other' | 'notes';

interface ContactFormData {
  firstName: string;
  lastName: string;
  displayName: string;
  middleName: string;
  suffix: string;
  nickname: string;
  title: string;
  email: string;
  email2: string;
  email3: string;
  phone: string;
  phone2: string;
  mobilePhone: string;
  company: string;
  jobTitle: string;
  department: string;
  office: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  birthday: string;
  anniversary: string;
  spouse: string;
  website: string;
  notes: string;
  category: string;
}

interface ContactDialogProps {
  isOpen: boolean;
  contact?: Contact | null;
  onClose: () => void;
  onSave: (data: Partial<ContactDto>) => void;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'contact', label: 'Contact information' },
  { id: 'work', label: 'Work' },
  { id: 'address', label: 'Address' },
  { id: 'other', label: 'Other' },
  { id: 'notes', label: 'Notes' },
];

function buildFormData(contact?: Contact | null): ContactFormData {
  if (!contact) {
    return {
      firstName: '', lastName: '', displayName: '', middleName: '', suffix: '',
      nickname: '', title: '', email: '', email2: '', email3: '', phone: '', phone2: '',
      mobilePhone: '', company: '', jobTitle: '', department: '', office: '',
      address: '', city: '', state: '', postalCode: '', country: '',
      birthday: '', anniversary: '', spouse: '', website: '', notes: '', category: '',
    };
  }
  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    displayName: contact.displayName,
    middleName: contact.middleName,
    suffix: contact.suffix,
    nickname: contact.nickname,
    title: contact.title,
    email: contact.emailAddresses[0] || '',
    email2: contact.emailAddresses[1] || '',
    email3: contact.emailAddresses[2] || '',
    phone: contact.phoneNumbers[0] || '',
    phone2: contact.phoneNumbers[1] || '',
    mobilePhone: contact.mobilePhone,
    company: contact.company,
    jobTitle: contact.jobTitle,
    department: contact.department,
    office: contact.office,
    address: contact.address,
    city: contact.city,
    state: contact.state,
    postalCode: contact.postalCode,
    country: contact.country,
    birthday: contact.birthday || '',
    anniversary: contact.anniversary || '',
    spouse: contact.spouse,
    website: contact.website,
    notes: contact.notes,
    category: contact.category,
  };
}

const ContactDialog: React.FC<ContactDialogProps> = ({ isOpen, contact, onClose, onSave }) => {
  const [formData, setFormData] = useState<ContactFormData>(() => buildFormData(contact));
  const [activeTab, setActiveTab] = useState<TabId>('contact');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [duplicates, setDuplicates] = useState<Contact[]>([]);
  const [duplicateChecked, setDuplicateChecked] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Progressive disclosure toggles
  const [showMoreName, setShowMoreName] = useState(false);
  const [showMoreEmail, setShowMoreEmail] = useState(false);
  const [showMorePhone, setShowMorePhone] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const data = buildFormData(contact);
      setFormData(data);
      setActiveTab('contact');
      setError('');
      setSaving(false);
      setPhotoFile(null);
      setPhotoPreview(contact?.photoUrl || '');
      setDuplicates([]);
      setDuplicateChecked(false);
      // Auto-expand sections if editing and data exists
      setShowMoreName(!!(data.middleName || data.suffix || data.nickname || data.title));
      setShowMoreEmail(!!(data.email2 || data.email3));
      setShowMorePhone(!!(data.mobilePhone || data.phone2));
    }
  }, [isOpen, contact]);

  if (!isOpen) return null;

  const isEditing = !!contact;

  const updateField = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
  };

  const handleSave = async () => {
    if (!formData.firstName.trim() && !formData.lastName.trim() && !formData.displayName.trim()) {
      setError('Please enter at least a name for this contact.');
      return;
    }

    if (!formData.phone.trim() && !formData.mobilePhone.trim()) {
      setError('At least one phone number is required (work phone or mobile phone).');
      setActiveTab('contact');
      return;
    }

    // Validate email format
    const emails = [formData.email, formData.email2, formData.email3].filter(Boolean);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of emails) {
      if (!emailRegex.test(email.trim())) {
        setError(`Invalid email format: ${email}`);
        setActiveTab('contact');
        return;
      }
    }

    // Validate website URL if provided
    if (formData.website.trim()) {
      try {
        const urlToTest = /^https?:\/\//i.test(formData.website.trim())
          ? formData.website.trim()
          : `https://${formData.website.trim()}`;
        new URL(urlToTest);
      } catch {
        setError('Invalid website URL. Please enter a valid URL (e.g., https://www.example.com).');
        setActiveTab('other');
        return;
      }
    }

    if (!isEditing && !duplicateChecked) {
      try {
        const displayName = formData.displayName.trim() || `${formData.firstName} ${formData.lastName}`.trim();
        const phones = [formData.phone, formData.phone2].filter(Boolean);
        const dupes = await contactService.checkDuplicates(displayName, phones, formData.mobilePhone.trim() || undefined);
        if (dupes.length > 0) {
          setDuplicates(dupes);
          setDuplicateChecked(true);
          return;
        }
      } catch {
        // Non-blocking
      }
      setDuplicateChecked(true);
    }

    setSaving(true);
    setError('');

    const emailAddresses = [formData.email, formData.email2, formData.email3].filter(Boolean);
    const phoneNumbers = [formData.phone, formData.phone2].filter(Boolean);

    const dto: Partial<ContactDto> = {
      first_name: formData.firstName.trim(),
      last_name: formData.lastName.trim(),
      display_name: `${formData.firstName} ${formData.lastName}`.trim() || formData.displayName.trim(),
      middle_name: formData.middleName.trim(),
      suffix: formData.suffix.trim(),
      nickname: formData.nickname.trim(),
      title: formData.title.trim(),
      email_addresses: emailAddresses,
      phone_numbers: phoneNumbers,
      mobile_phone: formData.mobilePhone.trim(),
      company: formData.company.trim(),
      job_title: formData.jobTitle.trim(),
      department: formData.department.trim(),
      office: formData.office.trim(),
      address: formData.address.trim(),
      city: formData.city.trim(),
      state: formData.state.trim(),
      postal_code: formData.postalCode.trim(),
      country: formData.country.trim(),
      birthday: formData.birthday || null,
      anniversary: formData.anniversary || null,
      spouse: formData.spouse.trim(),
      website: formData.website.trim(),
      notes: formData.notes.trim(),
      category: formData.category.trim(),
      skip_duplicate_check: duplicateChecked,
    };

    try {
      await onSave(dto);
      if (photoFile && contact?.id) {
        try { await contactService.uploadPhoto(contact.id, photoFile); } catch { /* best-effort */ }
      }
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const details = err?.response?.data?.details;
      let msg = 'Failed to save contact.';
      if (details && Array.isArray(details)) {
        msg = details.join(', ');
      } else if (apiError) {
        msg = apiError;
      } else if (err instanceof Error) {
        msg = err.message;
      }
      setError(msg);
      setSaving(false);
    }
  };

  const renderField = (label: string, field: keyof ContactFormData, type = 'text', placeholder = '') => (
    <div className="contact-dialog__field">
      <label>{label}</label>
      <input
        type={type}
        value={formData[field]}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const renderDateField = (label: string, field: keyof ContactFormData) => (
    <div className="contact-dialog__date-field">
      <label>{label}</label>
      <div className="contact-dialog__date-input-wrapper">
        <input
          type="date"
          value={formData[field]}
          onChange={(e) => updateField(field, e.target.value)}
          placeholder="Select a date"
        />
        {formData[field] && (
          <button
            type="button"
            className="contact-dialog__date-clear"
            onClick={() => updateField(field, '')}
            title="Clear date"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="contact-dialog__overlay" onClick={onClose}>
      <div className="contact-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Title bar */}
        <div className="contact-dialog__titlebar">
          <h3>{isEditing ? 'Edit contact' : 'New contact'}</h3>
          <button className="contact-dialog__close" onClick={onClose}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span>
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="contact-dialog__body">
          {/* Left sidebar tabs */}
          <div className="contact-dialog__sidebar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`contact-dialog__sidebar-tab ${activeTab === tab.id ? 'contact-dialog__sidebar-tab--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Right content */}
          <div className="contact-dialog__content">
            {error && (
              <div className="contact-dialog__error">
                <span className="material-symbols-outlined">error</span>
                {error}
              </div>
            )}

            {duplicates.length > 0 && (
              <div className="contact-dialog__warning">
                <span className="material-symbols-outlined">warning</span>
                <div>
                  <strong>Possible duplicates found:</strong>
                  <ul className="contact-dialog__dupe-list">
                    {duplicates.map(d => (
                      <li key={d.id}>{d.displayName} {d.emailAddresses[0] ? `(${d.emailAddresses[0]})` : ''}</li>
                    ))}
                  </ul>
                  <span className="contact-dialog__dupe-hint">Click Save again to create anyway.</span>
                </div>
              </div>
            )}

            {/* Contact information tab */}
            {activeTab === 'contact' && (
              <>
                {/* Photo upload */}
                <div className="contact-dialog__photo-row">
                  <div
                    className="contact-dialog__photo-preview"
                    onClick={() => photoInputRef.current?.click()}
                    title="Click to upload photo"
                  >
                    {photoPreview ? (
                      <img src={photoPreview} alt="Contact" />
                    ) : (
                      <span className="material-symbols-outlined">add_a_photo</span>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    onChange={handlePhotoChange}
                    style={{ display: 'none' }}
                  />
                  <div className="contact-dialog__photo-info">
                    <span className="contact-dialog__photo-label">Add a photo</span>
                    <span className="contact-dialog__photo-hint">Click to upload</span>
                    {photoPreview && (
                      <button className="contact-dialog__photo-remove" onClick={handleRemovePhoto}>
                        Remove photo
                      </button>
                    )}
                  </div>
                </div>

                {/* Name section */}
                <div className="contact-dialog__section-title">Name</div>
                <div className="contact-dialog__row">
                  {renderField('First name', 'firstName', 'text', 'Enter first name')}
                  {renderField('Last name', 'lastName', 'text', 'Enter last name')}
                </div>
                {!showMoreName && (
                  <button className="contact-dialog__add-link" onClick={() => setShowMoreName(true)}>
                    <span>+</span><span>Add name</span>
                  </button>
                )}
                {showMoreName && (
                  <>
                    <div className="contact-dialog__row">
                      <div className="contact-dialog__field" style={{ maxWidth: 80 }}>
                        <label>Title</label>
                        <input type="text" value={formData.title} onChange={e => updateField('title', e.target.value)} placeholder="Mr./Ms." />
                      </div>
                      {renderField('Middle name', 'middleName', 'text', 'Enter middle name')}
                      <div className="contact-dialog__field" style={{ maxWidth: 80 }}>
                        <label>Suffix</label>
                        <input type="text" value={formData.suffix} onChange={e => updateField('suffix', e.target.value)} placeholder="Jr./Sr." />
                      </div>
                    </div>
                    {renderField('Nickname', 'nickname', 'text', 'Enter nickname')}
                  </>
                )}

                {/* Email section */}
                <div className="contact-dialog__section-title">Email</div>
                {renderField('Work email', 'email', 'email', 'name@company.com')}
                {!showMoreEmail && (
                  <button className="contact-dialog__add-link" onClick={() => setShowMoreEmail(true)}>
                    <span>+</span><span>Add email</span>
                  </button>
                )}
                {showMoreEmail && (
                  <>
                    {renderField('Personal email', 'email2', 'email', 'name@email.com')}
                    {renderField('Other email', 'email3', 'email', 'other@email.com')}
                  </>
                )}

                {/* Phone section */}
                <div className="contact-dialog__section-title">Phone</div>
                {renderField('Work phone *', 'phone', 'tel', '+1 (555) 000-0000')}
                {!showMorePhone && (
                  <button className="contact-dialog__add-link" onClick={() => setShowMorePhone(true)}>
                    <span>+</span><span>Add phone</span>
                  </button>
                )}
                {showMorePhone && (
                  <>
                    {renderField('Mobile phone', 'mobilePhone', 'tel', '+1 (555) 000-0000')}
                    {renderField('Home phone', 'phone2', 'tel', '+1 (555) 000-0000')}
                  </>
                )}
              </>
            )}

            {/* Work tab */}
            {activeTab === 'work' && (
              <>
                <div className="contact-dialog__section-title">Work</div>
                {renderField('Company', 'company', 'text', 'Enter company name')}
                {renderField('Job title', 'jobTitle', 'text', 'Enter job title')}
                {renderField('Department', 'department', 'text', 'Enter department')}
                {renderField('Office', 'office', 'text', 'Enter office location')}
              </>
            )}

            {/* Address tab */}
            {activeTab === 'address' && (
              <>
                <div className="contact-dialog__section-title">Address</div>
                {renderField('Street', 'address', 'text', 'Enter street address')}
                <div className="contact-dialog__row-3">
                  {renderField('City', 'city', 'text', 'Enter city')}
                  {renderField('State', 'state', 'text', 'State')}
                  {renderField('ZIP', 'postalCode', 'text', '00000')}
                </div>
                {renderField('Country/Region', 'country', 'text', 'Enter country')}
              </>
            )}

            {/* Other tab */}
            {activeTab === 'other' && (
              <>
                <div className="contact-dialog__section-title">Other</div>
                {renderDateField('Birthday', 'birthday')}
                {renderDateField('Anniversary', 'anniversary')}
                {renderField('Spouse/Partner', 'spouse', 'text', 'Enter name')}
                {renderField('Website', 'website', 'url', 'https://www.example.com')}
                {renderField('Category', 'category', 'text', 'Enter category')}
              </>
            )}

            {/* Notes tab */}
            {activeTab === 'notes' && (
              <>
                <div className="contact-dialog__section-title">Notes</div>
                <div className="contact-dialog__field">
                  <textarea
                    value={formData.notes}
                    onChange={(e) => updateField('notes', e.target.value)}
                    placeholder="Add notes about this contact..."
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="contact-dialog__footer">
          <button className="contact-dialog__btn contact-dialog__btn--cancel" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="contact-dialog__btn contact-dialog__btn--save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContactDialog;
