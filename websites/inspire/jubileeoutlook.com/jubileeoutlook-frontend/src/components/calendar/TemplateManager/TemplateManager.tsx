import React, { useState, useEffect } from 'react';
import { CalendarEvent } from '../../../types/calendar';
import { templateService, EventTemplate } from '../../../services/calendar/templateService';
import './TemplateManager.css';

interface TemplateManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: Partial<CalendarEvent>) => void;
}

const TemplateManager: React.FC<TemplateManagerProps> = ({ isOpen, onClose, onApplyTemplate }) => {
  const [templates, setTemplates] = useState<EventTemplate[]>([]);

  useEffect(() => {
    if (isOpen) setTemplates(templateService.getTemplates());
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = (id: string) => {
    const template = templateService.applyTemplate(id);
    if (template) {
      onApplyTemplate(template);
      onClose();
    }
  };

  const handleDelete = (id: string) => {
    templateService.deleteTemplate(id);
    setTemplates(templateService.getTemplates());
  };

  return (
    <div className="template-manager__overlay" onClick={onClose}>
      <div className="template-manager" onClick={(e) => e.stopPropagation()}>
        <div className="template-manager__header">
          <h3>Event Templates</h3>
          <button className="template-manager__close" onClick={onClose}>
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="template-manager__body">
          {templates.length === 0 ? (
            <div className="template-manager__empty">
              <span className="material-symbols-outlined">note_stack</span>
              <p>No templates saved yet.</p>
              <p className="template-manager__hint">
                Create an event and click "Save as Template" to save it here.
              </p>
            </div>
          ) : (
            <div className="template-manager__list">
              {templates.map((t) => (
                <div key={t.id} className="template-manager__item">
                  <div className="template-manager__item-info">
                    <span className="template-manager__item-name">{t.name}</span>
                    <span className="template-manager__item-details">
                      {t.template.title && `"${t.template.title}"`}
                      {t.template.isRecurring && ' (recurring)'}
                      {t.template.location && ` at ${t.template.location}`}
                    </span>
                  </div>
                  <div className="template-manager__item-actions">
                    <button
                      className="template-manager__item-btn template-manager__item-btn--apply"
                      onClick={() => handleApply(t.id)}
                    >
                      Apply
                    </button>
                    <button
                      className="template-manager__item-btn template-manager__item-btn--delete"
                      onClick={() => handleDelete(t.id)}
                      title="Delete template"
                    >
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;
