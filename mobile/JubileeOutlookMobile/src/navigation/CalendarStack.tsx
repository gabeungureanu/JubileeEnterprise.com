/**
 * CalendarStack — Stack navigator for the Calendar module.
 *
 * Contains screens for the calendar view, event detail, and new event
 * creation. The NewEvent screen opens as a modal overlay.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { CalendarStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import CalendarScreen from '../screens/calendar/CalendarScreen';
import EventDetailScreen from '../screens/calendar/EventDetailScreen';
import NewEventScreen from '../screens/calendar/NewEventScreen';

const Stack = createNativeStackNavigator<CalendarStackParamList>();

/**
 * Shared dark header options used across all calendar screens.
 */
const darkScreenOptions = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTintColor: Colors.primary,
  headerTitleStyle: { color: Colors.textPrimary },
  contentStyle: { backgroundColor: Colors.background },
} as const;

/**
 * CalendarStack renders the calendar navigation flow with dark headers,
 * gold tint, and white title text.
 */
const CalendarStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={darkScreenOptions}>
      <Stack.Screen
        name="CalendarMain"
        component={CalendarScreen}
        options={{ title: 'Calendar' }}
      />
      <Stack.Screen
        name="EventDetail"
        component={EventDetailScreen}
        options={{ title: 'Event' }}
      />
      <Stack.Screen
        name="NewEvent"
        component={NewEventScreen}
        options={{
          title: 'New Event',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
};

export default CalendarStack;
