/**
 * PeopleStack — Stack navigator for the People / Contacts module.
 *
 * Contains screens for the contacts list, contact detail, and contact
 * edit/create. The ContactEdit screen opens as a modal overlay.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { PeopleStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import PeopleScreen from '../screens/people/PeopleScreen';
import ContactDetailScreen from '../screens/people/ContactDetailScreen';
import ContactEditScreen from '../screens/people/ContactEditScreen';

const Stack = createNativeStackNavigator<PeopleStackParamList>();

/**
 * Shared dark header options used across all people screens.
 */
const darkScreenOptions = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTintColor: Colors.primary,
  headerTitleStyle: { color: Colors.textPrimary },
  contentStyle: { backgroundColor: Colors.background },
} as const;

/**
 * PeopleStack renders the contacts navigation flow with dark headers,
 * gold tint, and white title text.
 */
const PeopleStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={darkScreenOptions}>
      <Stack.Screen
        name="PeopleMain"
        component={PeopleScreen}
        options={{ title: 'People' }}
      />
      <Stack.Screen
        name="ContactDetail"
        component={ContactDetailScreen}
        options={{ title: 'Contact' }}
      />
      <Stack.Screen
        name="ContactEdit"
        component={ContactEditScreen}
        options={{
          title: 'Edit Contact',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
    </Stack.Navigator>
  );
};

export default PeopleStack;
