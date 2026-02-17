import { CalendarEvent } from '../../types/calendar';

const STORAGE_KEY = 'jubilee_calendar_templates';

export interface EventTemplate {
  id: string;
  name: string;
  template: Partial<CalendarEvent>;
  createdAt: string;
}

export const templateService = {
  getTemplates(): EventTemplate[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },

  saveTemplate(name: string, template: Partial<CalendarEvent>): EventTemplate {
    const templates = this.getTemplates();
    const newTemplate: EventTemplate = {
      id: crypto.randomUUID(),
      name,
      template: {
        title: template.title,
        description: template.description,
        location: template.location,
        isAllDay: template.isAllDay,
        isInPerson: template.isInPerson,
        showAs: template.showAs,
        category: template.category,
        eventColor: template.eventColor,
        reminderMinutes: template.reminderMinutes,
        isRecurring: template.isRecurring,
        recurrenceType: template.recurrenceType,
        recurrenceInterval: template.recurrenceInterval,
        recurrenceDaysOfWeek: template.recurrenceDaysOfWeek,
      },
      createdAt: new Date().toISOString(),
    };
    templates.push(newTemplate);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
    return newTemplate;
  },

  deleteTemplate(id: string): void {
    const templates = this.getTemplates().filter((t) => t.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
  },

  applyTemplate(templateId: string): Partial<CalendarEvent> | null {
    const template = this.getTemplates().find((t) => t.id === templateId);
    return template ? { ...template.template } : null;
  },
};
