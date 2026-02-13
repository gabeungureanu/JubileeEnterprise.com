import React, { useState, useRef, useCallback, useEffect } from 'react';
import { contactService } from '../../../services/contacts/contactService';
import './RecipientInput.css';

export interface Recipient {
  name: string;
  email: string;
}

interface RecipientInputProps {
  recipients: Recipient[];
  onChange: (recipients: Recipient[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]);
  return name.substring(0, 2);
}

function parseEmailEntry(entry: string): Recipient {
  const trimmed = entry.trim();
  const match = trimmed.match(/^"?([^"<]*)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: '', email: trimmed };
}

const RecipientInput: React.FC<RecipientInputProps> = ({ recipients, onChange, placeholder, autoFocus }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<{ name: string; email: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchContacts = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    try {
      const result = await contactService.searchContacts(query, 1, 10);
      const items: { name: string; email: string }[] = [];
      for (const contact of result.contacts) {
        for (const email of contact.emailAddresses) {
          items.push({ name: contact.displayName, email });
        }
      }
      setSuggestions(items);
      setShowDropdown(items.length > 0);
      setHighlightIndex(-1);
    } catch {
      setSuggestions([]);
      setShowDropdown(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchContacts(val), 300);
  };

  const addRecipient = useCallback((recipient: Recipient) => {
    if (!recipient.email) return;
    const exists = recipients.some((r) => r.email.toLowerCase() === recipient.email.toLowerCase());
    if (!exists) {
      onChange([...recipients, recipient]);
    }
    setInputValue('');
    setSuggestions([]);
    setShowDropdown(false);
    inputRef.current?.focus();
  }, [recipients, onChange]);

  const commitInput = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    // Split by comma or semicolon
    const parts = trimmed.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
    const newRecipients = [...recipients];
    for (const part of parts) {
      const recipient = parseEmailEntry(part);
      if (recipient.email && !newRecipients.some((r) => r.email.toLowerCase() === recipient.email.toLowerCase())) {
        newRecipients.push(recipient);
      }
    }
    onChange(newRecipients);
    setInputValue('');
    setSuggestions([]);
    setShowDropdown(false);
  }, [inputValue, recipients, onChange]);

  const removeRecipient = useCallback((index: number) => {
    const updated = recipients.filter((_, i) => i !== index);
    onChange(updated);
  }, [recipients, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showDropdown && highlightIndex >= 0 && highlightIndex < suggestions.length) {
        e.preventDefault();
        addRecipient(suggestions[highlightIndex]);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        commitInput();
      }
    } else if (e.key === 'Backspace' && !inputValue && recipients.length > 0) {
      removeRecipient(recipients.length - 1);
    } else if (e.key === ';' || e.key === ',') {
      e.preventDefault();
      commitInput();
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleBlur = useCallback(() => {
    // Delay to allow click on dropdown item
    setTimeout(() => {
      commitInput();
      setShowDropdown(false);
    }, 200);
  }, [commitInput]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="recipient-input" onClick={() => inputRef.current?.focus()}>
      {recipients.map((r, i) => (
        <span key={`${r.email}-${i}`} className="recipient-input__chip">
          <span className="recipient-input__chip-text">
            {r.name ? `${r.name} <${r.email}>` : r.email}
          </span>
          <button
            className="recipient-input__chip-remove"
            onClick={(e) => { e.stopPropagation(); removeRecipient(i); }}
            tabIndex={-1}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        className="recipient-input__text"
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={recipients.length === 0 ? (placeholder || 'Add recipients') : ''}
        autoFocus={autoFocus}
      />

      {showDropdown && suggestions.length > 0 && (
        <div className="recipient-input__dropdown" ref={dropdownRef}>
          {suggestions.map((s, i) => (
            <div
              key={`${s.email}-${i}`}
              className={`recipient-input__option ${i === highlightIndex ? 'recipient-input__option--highlighted' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); addRecipient(s); }}
              onMouseEnter={() => setHighlightIndex(i)}
            >
              <div className="recipient-input__option-avatar">
                {s.name ? getInitials(s.name) : s.email.substring(0, 2)}
              </div>
              <div className="recipient-input__option-info">
                {s.name && <div className="recipient-input__option-name">{s.name}</div>}
                <div className="recipient-input__option-email">{s.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecipientInput;
