import React, { useState } from 'react';
import { ContactDto } from '../../../types/contacts';
import './ContactDialog.css';

interface ContactFormData {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  notes: string;
}

interface ContactDialogProps {
  isOpen: boolean;
  initialData?: Partial<ContactDto>;
  onClose: () => void;
  onSave: (data: Partial<ContactDto>) => void;
}

const ContactDialog: React.FC<ContactDialogProps> = ({ isOpen, initialData, onClose, onSave }) => {
  const [formData, setFormData] = useState<ContactFormData>({
    firstName: initialData?.first_name || '',
    lastName: initialData?.last_name || '',
    displayName: initialData?.display_name || '',
    email: initialData?.email_addresses?.[0] || '',
    phone: initialData?.phone_numbers?.[0] || '',
    company: initialData?.company || '',
    jobTitle: initialData?.job_title || '',
    notes: initialData?.notes || '',
  });

  if (!isOpen) return null;

  const updateField = (field: keyof ContactFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const dto: Partial<ContactDto> = {
      first_name: formData.firstName,
      last_name: formData.lastName,
      display_name: formData.displayName || `${formData.firstName} ${formData.lastName}`.trim(),
      email_addresses: formData.email ? [formData.email] : [],
      phone_numbers: formData.phone ? [formData.phone] : [],
      company: formData.company,
      job_title: formData.jobTitle,
      notes: formData.notes,
    };
    onSave(dto);
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
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>

          <div className="contact-dialog__field">
            <label>Phone</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>

          <div className="contact-dialog__row">
            <div className="contact-dialog__field">
              <label>Company</label>
              <input type="text" value={formData.company} onChange={(e) => updateField('company', e.target.value)} />
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
