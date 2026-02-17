/**
 * NewEventScreen — Create or edit a calendar event.
 *
 * When an existing event is passed via route params the form is
 * pre-filled for editing; otherwise it defaults to a blank form
 * with the selected date (if provided).
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner } from '../../components/common';
import { calendarService } from '../../services/calendar/calendarService';
import { tokenStore } from '../../services/apiClient';
import type { CalendarEvent, CalendarEventDto } from '../../types/calendar';
import type { CalendarStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<CalendarStackParamList, 'NewEvent'>;
type Route = RouteProp<CalendarStackParamList, 'NewEvent'>;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const REMINDER_OPTIONS = [
  { label: 'None', value: 0 },
  { label: '5 minutes', value: 5 },
  { label: '15 minutes', value: 15 },
  { label: '30 minutes', value: 30 },
  { label: '1 hour', value: 60 },
  { label: '1 day', value: 1440 },
];

function formatDateTimeForDisplay(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getDefaultStart(date?: string): string {
  const d = date ? new Date(date) : new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function getDefaultEnd(startIso: string): string {
  const d = new Date(startIso);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const NewEventScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { date, event: existingEvent } = route.params || {};

  const isEditing = !!existingEvent;

  // ── Form state ────────────────────────────────────────────

  const [subject, setSubject] = useState(existingEvent?.title || '');
  const [location, setLocation] = useState(existingEvent?.location || '');
  const [description, setDescription] = useState(existingEvent?.description || '');
  const [startTime, setStartTime] = useState(
    existingEvent?.startDateTime || getDefaultStart(date),
  );
  const [endTime, setEndTime] = useState(
    existingEvent?.endDateTime || getDefaultEnd(existingEvent?.startDateTime || getDefaultStart(date)),
  );
  const [isAllDay, setIsAllDay] = useState(existingEvent?.isAllDay || false);
  const [isInPerson, setIsInPerson] = useState(existingEvent?.isInPerson || false);
  const [reminderMinutes, setReminderMinutes] = useState(
    existingEvent?.reminderMinutes ?? 15,
  );
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // ── Navigation title ──────────────────────────────────────

  useEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Event' : 'New Event',
    });
  }, [isEditing, navigation]);

  // ── Time adjustment helpers ───────────────────────────────

  const adjustTime = useCallback(
    (which: 'start' | 'end', direction: 'forward' | 'back') => {
      const setter = which === 'start' ? setStartTime : setEndTime;
      const current = which === 'start' ? startTime : endTime;
      const d = new Date(current);
      const delta = direction === 'forward' ? 30 : -30;
      d.setMinutes(d.getMinutes() + delta);
      setter(d.toISOString());

      // Keep end after start
      if (which === 'start') {
        const newStart = d.getTime();
        const currentEnd = new Date(endTime).getTime();
        if (currentEnd <= newStart) {
          const autoEnd = new Date(newStart);
          autoEnd.setHours(autoEnd.getHours() + 1);
          setEndTime(autoEnd.toISOString());
        }
      }
    },
    [startTime, endTime],
  );

  // ── Save ──────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!subject.trim()) {
      Alert.alert('Validation', 'Subject is required');
      return;
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (!isAllDay && end <= start) {
      Alert.alert('Validation', 'End time must be after start time');
      return;
    }

    const userId = tokenStore.getUserId();
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<CalendarEventDto> = {
        userId,
        subject: subject.trim(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
        startTime: startTime,
        endTime: endTime,
        isAllDay,
        isInPerson,
        reminderMinutes,
      };

      if (isEditing && existingEvent) {
        await calendarService.updateEvent(existingEvent.id, payload);
      } else {
        await calendarService.createEvent(payload);
      }

      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to save event');
    } finally {
      setIsSaving(false);
    }
  }, [
    subject, location, description, startTime, endTime,
    isAllDay, isInPerson, reminderMinutes, isEditing, existingEvent, navigation,
  ]);

  // ── Render ────────────────────────────────────────────────

  const selectedReminder =
    REMINDER_OPTIONS.find((r) => r.value === reminderMinutes) || REMINDER_OPTIONS[2];

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Subject */}
        <View style={styles.field}>
          <Text style={styles.label}>Subject *</Text>
          <TextInput
            style={styles.textInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="Event subject"
            placeholderTextColor={Colors.textTertiary}
            autoFocus={!isEditing}
          />
        </View>

        {/* Location */}
        <View style={styles.field}>
          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.textInput}
            value={location}
            onChangeText={setLocation}
            placeholder="Add location"
            placeholderTextColor={Colors.textTertiary}
          />
        </View>

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

        {/* Start time */}
        {!isAllDay && (
          <View style={styles.field}>
            <Text style={styles.label}>Start</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity
                onPress={() => adjustTime('start', 'back')}
                style={styles.timeArrow}
              >
                <Icon name="remove" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.timeDisplay}>
                {formatDateTimeForDisplay(startTime)}
              </Text>
              <TouchableOpacity
                onPress={() => adjustTime('start', 'forward')}
                style={styles.timeArrow}
              >
                <Icon name="add" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* End time */}
        {!isAllDay && (
          <View style={styles.field}>
            <Text style={styles.label}>End</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity
                onPress={() => adjustTime('end', 'back')}
                style={styles.timeArrow}
              >
                <Icon name="remove" size={20} color={Colors.primary} />
              </TouchableOpacity>
              <Text style={styles.timeDisplay}>
                {formatDateTimeForDisplay(endTime)}
              </Text>
              <TouchableOpacity
                onPress={() => adjustTime('end', 'forward')}
                style={styles.timeArrow}
              >
                <Icon name="add" size={20} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Reminder picker */}
        <View style={styles.field}>
          <Text style={styles.label}>Reminder</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowReminderPicker(!showReminderPicker)}
          >
            <Icon name="notifications" size={20} color={Colors.textSecondary} />
            <Text style={styles.pickerText}>{selectedReminder.label}</Text>
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
                  key={opt.value}
                  style={[
                    styles.pickerOption,
                    opt.value === reminderMinutes && styles.pickerOptionActive,
                  ]}
                  onPress={() => {
                    setReminderMinutes(opt.value);
                    setShowReminderPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      opt.value === reminderMinutes && styles.pickerOptionTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

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

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.textInput, styles.multilineInput]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add description"
            placeholderTextColor={Colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
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
  field: {
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
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

  // Toggle rows
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  toggleLabel: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.md,
  },

  // Time picker
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  timeArrow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  timeDisplay: {
    flex: 1,
    textAlign: 'center',
    ...Typography.body,
    color: Colors.textPrimary,
  },

  // Reminder picker
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.surface,
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
    backgroundColor: Colors.surfaceLight,
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
