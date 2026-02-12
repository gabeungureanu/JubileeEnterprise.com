import React, { useState } from 'react';
import { ContactFormData } from '../../../types/contacts';
import './ContactDialog.css';

interface ContactDialogProps {
  isOpen: boolean;
  initialData?: Partial<ContactFormData>;
  onClose: () => void;
  onSave: (data: ContactFormData) => void;
}

const ContactDialog: React.FC<ContactDialogProps> = ({ isOpen, initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState<ContactFormData>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    displayName: initialData?.displayName || '',
    emailAddresses: initialData?.emailAddresses || [{ type: 'work', address: '', isPrimary: true }],
    phoneNumbers: initialData?.phoneNumbers || [{ type: 'mobile', number: '', isPrimary: true }],
    organization: initialData?.organization || '',
    jobTitle: initialData?.jobTitle || '',
    birthday: initialData?.birthday || null,
    anniversary: initialData?.anniversary || null,
    notes: initialData?.notes || '',
    groups: initialData?.groups || [],
  });

  if (!isOpen) return null;

  const updateField = (field: keyof ContactFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  return (
    <div className="contact-dialog__overlay" onClick={onClose}>
      <div className="contact-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="contact-dialog__header">
          <h3>{initialData ? 'Edit Contact' : 'New Contact'}</h3>
          <button className="contact-dialog__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="contact-dialog__body">
          <div className="contact-dialog__row">
            <div className="contact-dialog__field">
              <label>First Name</label>
              <input type="text" value={formData.firstName} onChange={(e) => updateField('firstName', e.target.value)} />
            </div>
            <div className="contact-dialog__field">
              <label>Last Name</label>
              <input type="text" value={formData.lastName} onChange={(e) => updateField('lastName', e.target.value)} />
            </div>
          </div>

          <div className="contact-dialog__field">
            <label>Display Name</label>
            <input type="text" value={formData.displayName} onChange={(e) => updateField('displayName', e.target.value)} />
          </div>

          <div className="contact-dialog__field">
            <label>Email</label>
            <input
              type="email"
              value={formData.emailAddresses[0]?.address || ''}
              onChange={(e) => updateField('emailAddresses', [{ ...formData.emailAddresses[0], address: e.target.value }])}
            />
          </div>

          <div className="contact-dialog__field">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phoneNumbers[0]?.number || ''}
              onChange={(e) => updateField('phoneNumbers', [{ ...formData.phoneNumbers[0], number: e.target.value }])}
            />
          </div>

          <div className="contact-dialog__row">
            <div className="contact-dialog__field">
              <label>Organization</label>
              <input type="text" value={formData.organization} onChange={(e) => updateField('organization', e.target.value)} />
            </div>
            <div className="contact-dialog__field">
              <label>Job Title</label>
              <input type="text" value={formData.jobTitle} onChange={(e) => updateField('jobTitle', e.target.value)} />
            </div>
          </div>

          <div className="contact-dialog__field">
            <label>Notes</label>
            <textarea value={formData.notes} onChange={(e) => updateField('notes', e.target.value)} />
          </div>
        </div>

        <div className="contact-dialog__footer">
          <button className="contact-dialog__btn contact-dialog__btn--cancel" onClick={onClose}>Cancel</button>
          <button className="contact-dialog__btn contact-dialog__btn--save" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
};

export default ContactDialog;
