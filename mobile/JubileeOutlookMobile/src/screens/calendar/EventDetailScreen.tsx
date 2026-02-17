/**
 * EventDetailScreen — Displays full details for a single calendar event.
 *
 * Shows subject, date/time range, location, description, attendees,
 * and attachments. A colour strip at the top reflects the event colour.
 * The header contains Edit and Delete actions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner, Avatar, EmptyState } from '../../components/common';
import { calendarService } from '../../services/calendar/calendarService';
import type { CalendarEvent } from '../../types/calendar';
import type { CalendarStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<CalendarStackParamList, 'EventDetail'>;
type Route = RouteProp<CalendarStackParamList, 'EventDetail'>;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const EventDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { eventId, event: routeEvent } = route.params;

  const [event, setEvent] = useState<CalendarEvent | null>(routeEvent || null);
  const [isLoading, setIsLoading] = useState(!routeEvent);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch event ───────────────────────────────────────────

  const fetchEvent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await calendarService.getEvent(eventId);
      setEvent(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!routeEvent) {
      fetchEvent();
    }
  }, [routeEvent, fetchEvent]);

  // ── Header buttons ────────────────────────────────────────

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerButton}
          >
            <Icon name="edit" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerButton}
          >
            <Icon name="delete" size={22} color={Colors.error} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [event]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────

  const handleEdit = useCallback(() => {
    if (event) {
      navigation.navigate('NewEvent', { event });
    }
  }, [event, navigation]);

  const handleDelete = useCallback(() => {
    Alert.alert('Delete Event', 'Are you sure you want to delete this event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await calendarService.deleteEvent(eventId);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Failed to delete event');
          }
        },
      },
    ]);
  }, [eventId, navigation]);

  // ── Render ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon="error-outline"
          title="Event not found"
          subtitle={error || 'Unable to load event details'}
        />
      </View>
    );
  }

  const eventColor = event.eventColor || Colors.accent;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Colour strip */}
      <View style={[styles.colorStrip, { backgroundColor: eventColor }]} />

      {/* Subject */}
      <Text style={styles.subject}>{event.subject}</Text>

      {/* Date / time */}
      <View style={styles.detailRow}>
        <Icon name="access-time" size={20} color={Colors.textSecondary} />
        <View style={styles.detailContent}>
          {event.isAllDay ? (
            <>
              <Text style={styles.detailPrimary}>All Day</Text>
              <Text style={styles.detailSecondary}>
                {formatDateOnly(event.startTime)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.detailPrimary}>
                {formatDateTime(event.startTime)}
              </Text>
              <Text style={styles.detailSecondary}>
                to {formatDateTime(event.endTime)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Location */}
      {!!event.location && (
        <View style={styles.detailRow}>
          <Icon name="place" size={20} color={Colors.textSecondary} />
          <View style={styles.detailContent}>
            <Text style={styles.detailPrimary}>{event.location}</Text>
            {event.isInPerson && (
              <Text style={styles.detailSecondary}>In Person</Text>
            )}
          </View>
        </View>
      )}

      {/* Description */}
      {!!event.description && (
        <View style={styles.detailRow}>
          <Icon name="notes" size={20} color={Colors.textSecondary} />
          <View style={styles.detailContent}>
            <Text style={styles.detailPrimary}>{event.description}</Text>
          </View>
        </View>
      )}

      {/* Reminder */}
      {event.reminderMinutes > 0 && (
        <View style={styles.detailRow}>
          <Icon name="notifications" size={20} color={Colors.textSecondary} />
          <View style={styles.detailContent}>
            <Text style={styles.detailPrimary}>
              {event.reminderMinutes} minutes before
            </Text>
          </View>
        </View>
      )}

      {/* Attendees */}
      {event.attendees && event.attendees.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendees</Text>
          {event.attendees.map((attendee, idx) => (
            <View key={attendee.id || `attendee-${idx}`} style={styles.attendeeRow}>
              <Avatar name={attendee.name || attendee.email} size={36} />
              <View style={styles.attendeeInfo}>
                <Text style={styles.attendeeName}>
                  {attendee.name || attendee.email}
                </Text>
                {attendee.name && (
                  <Text style={styles.attendeeEmail}>{attendee.email}</Text>
                )}
              </View>
              <View
                style={[
                  styles.statusBadge,
                  attendee.responseStatus === 'accepted' && styles.statusAccepted,
                  attendee.responseStatus === 'declined' && styles.statusDeclined,
                  attendee.responseStatus === 'tentative' && styles.statusTentative,
                ]}
              >
                <Text style={styles.statusText}>
                  {attendee.responseStatus}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Attachments */}
      {event.attachments && event.attachments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attachments</Text>
          {event.attachments.map((att, idx) => (
            <View key={att.id || `att-${idx}`} style={styles.attachmentRow}>
              <Icon name="attach-file" size={20} color={Colors.textSecondary} />
              <Text style={styles.attachmentName} numberOfLines={1}>
                {att.fileName}
              </Text>
              {att.fileSize && (
                <Text style={styles.attachmentSize}>
                  {(att.fileSize / 1024).toFixed(0)} KB
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
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
  content: {
    paddingBottom: Spacing.xxxxl,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: Spacing.lg,
  },

  // Colour strip
  colorStrip: {
    height: 6,
    width: '100%',
  },

  // Subject
  subject: {
    ...Typography.h2,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },

  // Detail rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  detailContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  detailPrimary: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  detailSecondary: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Sections
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Attendees
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  attendeeInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  attendeeName: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  attendeeEmail: {
    ...Typography.bodySmall,
    color: Colors.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  statusAccepted: {
    backgroundColor: 'rgba(16, 124, 16, 0.2)',
  },
  statusDeclined: {
    backgroundColor: 'rgba(209, 52, 56, 0.2)',
  },
  statusTentative: {
    backgroundColor: 'rgba(255, 140, 0, 0.2)',
  },
  statusText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textTransform: 'capitalize',
  },

  // Attachments
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  attachmentName: {
    ...Typography.body,
    color: Colors.textPrimary,
    flex: 1,
    marginLeft: Spacing.sm,
  },
  attachmentSize: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});

export default EventDetailScreen;
