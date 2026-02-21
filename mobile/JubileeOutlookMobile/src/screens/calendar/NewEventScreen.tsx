/**
 * NewEventScreen — Create or edit a calendar event.
 *
 * Redesigned with collapsible FormSection cards for mobile usability.
 * Includes all fields matching web frontend feature parity:
 * subject, location, date/time, recurrence, showAs, reminder,
 * color, private, attendees, attachments, description, timezone.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner, FormSection } from '../../components/common';
import {
  TimePickerSheet,
  DatePickerField,
  EventColorPicker,
  ShowAsPicker,
  RecurrenceEditor,
  AttendeeInput,
  AttachmentPicker,
  TimezonePickerSheet,
} from '../../components/modules/calendar';
import type { PickedFile } from '../../components/modules/calendar';
import { useAlert } from '../../hooks';
import { calendarService } from '../../services/calendar/calendarService';
import { fileService } from '../../services/calendar/fileService';
import { reminderService } from '../../services/calendar/reminderService';
import { tokenStore } from '../../services/apiClient';
import {
  REMINDER_OPTIONS,
  formatTime24h,
  getLastUsedTimes,
  saveLastUsedTimes,
} from '../../utils/calendarUtils';
import type { CalendarEventDto, EventAttachment, ShowAsStatus } from '../../types/calendar';
import type { CalendarStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<CalendarStackParamList, 'NewEvent'>;
type Route = RouteProp<CalendarStackParamList, 'NewEvent'>;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function getDefaultStart(date?: string): Date {
  const d = date ? new Date(date) : new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function getDefaultEnd(start: Date): Date {
  const d = new Date(start);
  d.setHours(d.getHours() + 1);
  return d;
}

function formatDuration(startMs: number, endMs: number): string {
  const diff = Math.max(endMs - startMs, 0);
  const totalMinutes = Math.round(diff / 60000);
  if (totalMinutes < 60) return `${totalMinutes} minutes`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  return `${hours} hour${hours > 1 ? 's' : ''} ${mins} min`;
}

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  json: 'application/json',
  zip: 'application/zip',
};

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return MIME_MAP[ext] || 'application/octet-stream';
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const NewEventScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { alert, AlertComponent } = useAlert();
  const { date, event: existingEvent } = route.params || {};

  const isEditing = !!existingEvent;

  // ── Form state ────────────────────────────────────────────
  const [subject, setSubject] = useState(existingEvent?.title || '');
  const [location, setLocation] = useState(existingEvent?.location || '');
  const [description, setDescription] = useState(existingEvent?.description || '');
  const [isAllDay, setIsAllDay] = useState(existingEvent?.isAllDay || false);
  const [isInPerson, setIsInPerson] = useState(existingEvent?.isInPerson ?? true);

  // Date/time
  const initialStart = existingEvent
    ? new Date(existingEvent.startDateTime)
    : getDefaultStart(date);
  const initialEnd = existingEvent
    ? new Date(existingEvent.endDateTime)
    : getDefaultEnd(initialStart);

  const [startDate, setStartDate] = useState<Date>(initialStart);
  const [endDate, setEndDate] = useState<Date>(initialEnd);

  // Time picker sheets
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  // Reminder
  const [reminderMinutes, setReminderMinutes] = useState(
    existingEvent?.reminderMinutes ?? 15,
  );
  const [showReminderPicker, setShowReminderPicker] = useState(false);

  // ShowAs
  const [showAs, setShowAs] = useState<ShowAsStatus>(
    (existingEvent?.showAs as ShowAsStatus) || 'busy',
  );

  // Event color
  const [eventColor, setEventColor] = useState(existingEvent?.eventColor || 'blue');

  // Private
  const [isPrivate, setIsPrivate] = useState(existingEvent?.isPrivate || false);

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(existingEvent?.isRecurring || false);
  const [recurrenceType, setRecurrenceType] = useState(
    existingEvent?.recurrenceType
      ? existingEvent.recurrenceType.charAt(0).toUpperCase() +
        existingEvent.recurrenceType.slice(1)
      : 'Daily',
  );
  const [recurrenceInterval, setRecurrenceInterval] = useState(
    existingEvent?.recurrenceInterval || 1,
  );
  const [recurrenceDaysOfWeek, setRecurrenceDaysOfWeek] = useState<string[]>(
    existingEvent?.recurrenceDaysOfWeek || [],
  );
  const [recurrenceEndCondition, setRecurrenceEndCondition] = useState<string>(() => {
    if (existingEvent?.recurrenceEndDate) return 'On date';
    if (existingEvent?.recurrenceOccurrences) return 'After occurrences';
    return 'Never';
  });
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(
    existingEvent?.recurrenceEndDate ? new Date(existingEvent.recurrenceEndDate) : null,
  );
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState<number | null>(
    existingEvent?.recurrenceOccurrences || null,
  );

  // Attendees
  const [attendees, setAttendees] = useState<string[]>(existingEvent?.attendees || []);

  // Attachments — seed from existing event when editing
  const [attachments, setAttachments] = useState<PickedFile[]>(() => {
    if (existingEvent?.attachments?.length) {
      return existingEvent.attachments.map((a: EventAttachment) => ({
        name: a.fileName,
        size: a.fileSize,
        uri: a.fileUrl,
        mimeType: guessMimeType(a.fileName),
      }));
    }
    return [];
  });

  // Timezone
  const [timezone, setTimezone] = useState(
    existingEvent?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  );
  const [showTimezonePicker, setShowTimezonePicker] = useState(false);

  // Save state
  const [isSaving, setIsSaving] = useState(false);

  // ── Navigation title ──────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Event' : 'New Event',
    });
  }, [isEditing, navigation]);

  // ── Load last-used times (new events only, not from a date tap) ─
  useEffect(() => {
    if (!isEditing && !date) {
      getLastUsedTimes().then((times) => {
        setStartDate((prev) => {
          const d = new Date(prev);
          d.setHours(times.startHour, times.startMin, 0, 0);
          return d;
        });
        setEndDate((prev) => {
          const d = new Date(prev);
          d.setHours(times.endHour, times.endMin, 0, 0);
          return d;
        });
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Time selection handlers ───────────────────────────────
  const handleStartTimeSelect = useCallback(
    (hour: number, minute: number) => {
      const d = new Date(startDate);
      d.setHours(hour, minute, 0, 0);
      setStartDate(d);
      // Auto-push end if needed
      if (d.getTime() >= endDate.getTime()) {
        const newEnd = new Date(d);
        newEnd.setHours(newEnd.getHours() + 1);
        setEndDate(newEnd);
      }
    },
    [startDate, endDate],
  );

  const handleEndTimeSelect = useCallback(
    (hour: number, minute: number) => {
      const d = new Date(endDate);
      d.setHours(hour, minute, 0, 0);
      if (d.getTime() > startDate.getTime()) {
        setEndDate(d);
      }
    },
    [endDate, startDate],
  );

  // ── Start/end date change handlers ────────────────────────
  const handleStartDateChange = useCallback(
    (d: Date) => {
      setStartDate(d);
      if (d.getTime() >= endDate.getTime()) {
        const newEnd = new Date(d);
        newEnd.setHours(newEnd.getHours() + 1);
        setEndDate(newEnd);
      }
    },
    [endDate],
  );

  // ── Recurrence day toggle ─────────────────────────────────
  const handleDayOfWeekToggle = useCallback((day: string) => {
    setRecurrenceDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  }, []);

  // ── Attendee handlers ─────────────────────────────────────
  const handleAddAttendee = useCallback((att: string) => {
    setAttendees((prev) => [...prev, att]);
  }, []);

  const handleRemoveAttendee = useCallback((idx: number) => {
    setAttendees((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Attachment handlers ───────────────────────────────────
  const handleAddAttachment = useCallback((file: PickedFile) => {
    setAttachments((prev) => [...prev, file]);
  }, []);

  const handleRemoveAttachment = useCallback((idx: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // ── Duration label ────────────────────────────────────────
  const durationLabel = useMemo(
    () => (isAllDay ? 'All day' : formatDuration(startDate.getTime(), endDate.getTime())),
    [isAllDay, startDate, endDate],
  );

  // ── Reminder label ────────────────────────────────────────
  const selectedReminderLabel =
    REMINDER_OPTIONS.find((r) => r.minutes === reminderMinutes)?.label || '15 minutes before';

  // ── Save ──────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!subject.trim()) {
      alert('Validation', 'Subject is required', 'warning');
      return;
    }

    if (!isAllDay && endDate <= startDate) {
      alert('Validation', 'End time must be after start time', 'warning');
      return;
    }

    const userId = tokenStore.getUserId();
    if (!userId) {
      alert('Error', 'User not authenticated', 'error');
      return;
    }

    setIsSaving(true);
    try {
      // ── Upload local attachments ───────────────────────────
      const uploadedAttachments: { fileName: string; fileUrl?: string; url?: string; filePath?: string; fileSize?: number; mimeType?: string }[] = [];
      for (const file of attachments) {
        const isLocal = file.uri.startsWith('file://') || file.uri.startsWith('content://');
        if (isLocal) {
          try {
            const result = await fileService.uploadFile({
              name: file.name,
              uri: file.uri,
              type: file.mimeType || 'application/octet-stream',
            });
            uploadedAttachments.push({
              fileName: result.fileName,
              fileUrl: result.fileUrl,
              url: result.fileUrl,
              filePath: result.fileUrl,
              fileSize: result.fileSize,
              mimeType: file.mimeType || undefined,
            });
          } catch (uploadErr: any) {
            alert('Upload Failed', `Failed to upload "${file.name}": ${uploadErr?.message || 'Unknown error'}`, 'error');
            setIsSaving(false);
            return;
          }
        } else {
          // Already-uploaded file (from edit mode) — keep existing reference
          uploadedAttachments.push({
            fileName: file.name,
            fileUrl: file.uri,
            url: file.uri,
            filePath: file.uri,
            fileSize: file.size,
            mimeType: file.mimeType || undefined,
          });
        }
      }

      // Build payload with both camelCase and snake_case keys (matching web frontend)
      const payload: Partial<CalendarEventDto> = {
        userId,
        user_id: userId,
        subject: subject.trim(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        startTime: startDate.toISOString(),
        start_time: startDate.toISOString(),
        endTime: endDate.toISOString(),
        end_time: endDate.toISOString(),
        isAllDay,
        is_all_day: isAllDay,
        isInPerson,
        is_in_person: isInPerson,
        reminderMinutes,
        reminder_minutes: reminderMinutes,
        status: showAs,
        eventColor,
        event_color: eventColor,
        isPrivate,
        is_private: isPrivate,
        timezone,
        attendees: attendees.length > 0 ? attendees : undefined,
        attachments: uploadedAttachments.length > 0 ? uploadedAttachments : undefined,
      };

      // Recurrence fields
      if (isRecurring) {
        payload.isRecurring = true;
        payload.is_recurring = true;
        payload.recurrenceType = recurrenceType.toLowerCase();
        payload.recurrence_type = recurrenceType.toLowerCase();
        payload.recurrenceInterval = recurrenceInterval;
        payload.recurrence_interval = recurrenceInterval;
        if (recurrenceType === 'Weekly' && recurrenceDaysOfWeek.length > 0) {
          payload.recurrenceDaysOfWeek = recurrenceDaysOfWeek;
          payload.recurrence_days_of_week = recurrenceDaysOfWeek;
        }
        if (recurrenceEndCondition === 'On date' && recurrenceEndDate) {
          payload.recurrenceEndDate = recurrenceEndDate.toISOString();
          payload.recurrence_end_date = recurrenceEndDate.toISOString();
        } else if (recurrenceEndCondition === 'After occurrences' && recurrenceOccurrences) {
          payload.recurrenceOccurrences = recurrenceOccurrences;
          payload.recurrence_occurrences = recurrenceOccurrences;
        }
      }

      let savedEvent;
      if (isEditing && existingEvent) {
        savedEvent = await calendarService.updateEvent(existingEvent.id, payload);
      } else {
        savedEvent = await calendarService.createEvent(payload);
      }

      // Schedule/reschedule device notification for the reminder
      if (savedEvent) {
        // Clear any previous dismiss so the fresh reminder can schedule
        await reminderService.undismiss(savedEvent.id);
        if (savedEvent.reminderMinutes > 0) {
          reminderService.scheduleReminder(savedEvent, true).catch((err) => {
            console.warn('[Reminder] Failed to schedule after save:', err);
          });
        } else if (isEditing && existingEvent) {
          reminderService.cancelReminder(existingEvent.id).catch((err) => {
            console.warn('[Reminder] Failed to cancel after save:', err);
          });
        }
      } else {
        console.warn('[Reminder] savedEvent is null — API may not have returned event data. Reminder not scheduled.');
      }

      // Persist start/end times for next new event (non-all-day only)
      if (!isAllDay) {
        saveLastUsedTimes(
          startDate.getHours(),
          startDate.getMinutes(),
          endDate.getHours(),
          endDate.getMinutes(),
        ).catch(() => {});
      }

      navigation.goBack();
    } catch (err: any) {
      alert('Error', err?.message || 'Failed to save event', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    subject, location, description, startDate, endDate, isAllDay, isInPerson,
    reminderMinutes, showAs, eventColor, isPrivate, timezone, attendees, attachments,
    isRecurring, recurrenceType, recurrenceInterval, recurrenceDaysOfWeek,
    recurrenceEndCondition, recurrenceEndDate, recurrenceOccurrences,
    isEditing, existingEvent, navigation, alert,
  ]);

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {AlertComponent}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* ── Section: Event Details (always expanded) ── */}
        <FormSection title="Event Details" icon="event" initiallyExpanded collapsible={false}>
          {/* Subject */}
          <Text style={styles.label}>Subject *</Text>
          <TextInput
            style={styles.textInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="Event subject"
            placeholderTextColor={Colors.textTertiary}
            autoFocus={!isEditing}
          />

          {/* Location */}
          <Text style={[styles.label, styles.fieldGap]}>Location</Text>
          <TextInput
            style={styles.textInput}
            value={location}
            onChangeText={setLocation}
            placeholder="Add location"
            placeholderTextColor={Colors.textTertiary}
          />

          {/* In Person toggle */}
          <View style={styles.toggleRow}>
            <Icon name="groups" size={20} color={Colors.textSecondary} />
            <Text style={styles.toggleLabel}>In Person</Text>
            <Switch
              value={isInPerson}
              onValueChange={setIsInPerson}
              trackColor={{ false: Colors.surfaceLight, true: Colors.primaryDark }}
              thumbColor={isInPerson ? Colors.primary : Colors.textTertiary}
            />
          </View>
        </FormSection>

        {/* ── Section: Date & Time (always expanded) ── */}
        <FormSection title="Date & Time" icon="schedule" initiallyExpanded collapsible={false}>
          {/* All Day toggle */}
          <View style={styles.toggleRow}>
            <Icon name="today" size={20} color={Colors.textSecondary} />
            <Text style={styles.toggleLabel}>All Day</Text>
            <Switch
              value={isAllDay}
              onValueChange={setIsAllDay}
              trackColor={{ false: Colors.surfaceLight, true: Colors.primaryDark }}
              thumbColor={isAllDay ? Colors.primary : Colors.textTertiary}
            />
          </View>

          {/* Start */}
          <Text style={styles.label}>Start</Text>
          <View style={styles.dateTimeRow}>
            <DatePickerField date={startDate} onDateChange={handleStartDateChange} />
            {!isAllDay && (
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowStartTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  {formatTime24h(startDate)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* End */}
          <Text style={[styles.label, styles.fieldGap]}>End</Text>
          <View style={styles.dateTimeRow}>
            <DatePickerField date={endDate} onDateChange={setEndDate} />
            {!isAllDay && (
              <TouchableOpacity
                style={styles.timeButton}
                onPress={() => setShowEndTimePicker(true)}
              >
                <Text style={styles.timeButtonText}>
                  {formatTime24h(endDate)}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Duration */}
          <Text style={styles.durationText}>{durationLabel}</Text>
        </FormSection>

        {/* ── Section: Recurrence ── */}
        <FormSection title="Recurrence" icon="repeat">
          {/* Toggle recurring */}
          <View style={styles.toggleRow}>
            <Icon name="repeat" size={20} color={Colors.textSecondary} />
            <Text style={styles.toggleLabel}>Make recurring</Text>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: Colors.surfaceLight, true: Colors.primaryDark }}
              thumbColor={isRecurring ? Colors.primary : Colors.textTertiary}
            />
          </View>

          {isRecurring && (
            <RecurrenceEditor
              recurrenceType={recurrenceType}
              recurrenceInterval={recurrenceInterval}
              recurrenceDaysOfWeek={recurrenceDaysOfWeek}
              recurrenceEndCondition={recurrenceEndCondition}
              recurrenceEndDate={recurrenceEndDate}
              recurrenceOccurrences={recurrenceOccurrences}
              onTypeChange={setRecurrenceType}
              onIntervalChange={setRecurrenceInterval}
              onDaysOfWeekToggle={handleDayOfWeekToggle}
              onEndConditionChange={(cond) => {
                setRecurrenceEndCondition(cond);
                if (cond === 'On date' && !recurrenceEndDate) {
                  const d = new Date(startDate);
                  d.setMonth(d.getMonth() + 3);
                  setRecurrenceEndDate(d);
                }
              }}
              onEndDateChange={setRecurrenceEndDate}
              onOccurrencesChange={setRecurrenceOccurrences}
            />
          )}
        </FormSection>

        {/* ── Section: Options ── */}
        <FormSection title="Options" icon="tune">
          {/* Show As */}
          <Text style={styles.label}>Show As</Text>
          <ShowAsPicker selected={showAs} onSelect={setShowAs} />

          {/* Reminder */}
          <Text style={[styles.label, styles.fieldGap]}>Reminder</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowReminderPicker(!showReminderPicker)}
          >
            <Icon name="notifications" size={20} color={Colors.textSecondary} />
            <Text style={styles.pickerText}>{selectedReminderLabel}</Text>
            <Icon
              name={showReminderPicker ? 'expand-less' : 'expand-more'}
              size={20}
              color={Colors.textTertiary}
            />
          </TouchableOpacity>
          {showReminderPicker && (
            <View style={styles.pickerOptions}>
              {REMINDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.minutes}
                  style={[
                    styles.pickerOption,
                    opt.minutes === reminderMinutes && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    setReminderMinutes(opt.minutes);
                    setShowReminderPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      opt.minutes === reminderMinutes && styles.pickerOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Event Color */}
          <Text style={[styles.label, styles.fieldGap]}>Color</Text>
          <EventColorPicker selected={eventColor} onSelect={setEventColor} />

          {/* Private toggle */}
          <View style={[styles.toggleRow, styles.fieldGap]}>
            <Icon name="lock" size={20} color={Colors.textSecondary} />
            <Text style={styles.toggleLabel}>Private</Text>
            <Switch
              value={isPrivate}
              onValueChange={setIsPrivate}
              trackColor={{ false: Colors.surfaceLight, true: Colors.primaryDark }}
              thumbColor={isPrivate ? Colors.primary : Colors.textTertiary}
            />
          </View>
        </FormSection>

        {/* ── Section: People ── */}
        <FormSection title="People" icon="people">
          <AttendeeInput
            attendees={attendees}
            onAdd={handleAddAttendee}
            onRemove={handleRemoveAttendee}
          />
        </FormSection>

        {/* ── Section: Attachments ── */}
        <FormSection title="Attachments" icon="attach-file">
          <AttachmentPicker
            files={attachments}
            onAdd={handleAddAttachment}
            onRemove={handleRemoveAttachment}
          />
        </FormSection>

        {/* ── Section: Notes ── */}
        <FormSection title="Notes" icon="notes">
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add description or notes"
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </FormSection>

        {/* ── Section: Timezone ── */}
        <FormSection title="Timezone" icon="public">
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowTimezonePicker(true)}
          >
            <Icon name="public" size={20} color={Colors.textSecondary} />
            <Text style={styles.pickerText}>{timezone}</Text>
            <Icon name="expand-more" size={20} color={Colors.textTertiary} />
          </TouchableOpacity>
        </FormSection>
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
              {isEditing ? 'Update Event' : 'Create Event'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Bottom sheet modals */}
      <TimePickerSheet
        visible={showStartTimePicker}
        onClose={() => setShowStartTimePicker(false)}
        selectedHour={startDate.getHours()}
        selectedMinute={startDate.getMinutes()}
        onSelect={handleStartTimeSelect}
        title="Start Time"
      />
      <TimePickerSheet
        visible={showEndTimePicker}
        onClose={() => setShowEndTimePicker(false)}
        selectedHour={endDate.getHours()}
        selectedMinute={endDate.getMinutes()}
        onSelect={handleEndTimeSelect}
        title="End Time"
      />
      <TimezonePickerSheet
        visible={showTimezonePicker}
        onClose={() => setShowTimezonePicker(false)}
        selected={timezone}
        onSelect={setTimezone}
      />
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

  // Fields
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  fieldGap: {
    marginTop: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.surfaceLight,
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

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  toggleLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.md,
  },

  // Date/time row
  dateTimeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  timeButton: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minWidth: 90,
    alignItems: 'center',
  },
  timeButtonText: {
    ...Typography.body,
    color: Colors.primary,
    fontWeight: '600',
  },
  durationText: {
    ...Typography.caption,
    color: Colors.textTertiary,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },

  // Picker (inline dropdown)
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  pickerText: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  pickerOptions: {
    marginTop: Spacing.xs,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  pickerOption: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  pickerOptionActive: {
    backgroundColor: Colors.primary + '15',
  },
  pickerOptionText: {
    ...Typography.body,
    color: Colors.textSecondary,
  },
  pickerOptionTextActive: {
    color: Colors.primary,
    fontWeight: '600',
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

export default NewEventScreen;
