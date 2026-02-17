/**
 * SettingsStack — Stack navigator for the Settings module.
 *
 * Contains the main settings screen. Sub-settings are handled as
 * in-page sections rather than separate screens, keeping the
 * settings flow simple and flat.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { SettingsStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

/**
 * Shared dark header options used across all settings screens.
 */
const darkScreenOptions = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTintColor: Colors.primary,
  headerTitleStyle: { color: Colors.textPrimary },
  contentStyle: { backgroundColor: Colors.background },
} as const;

/**
 * SettingsStack renders the settings navigation flow with dark headers,
 * gold tint, and white title text.
 */
const SettingsStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={darkScreenOptions}>
      <Stack.Screen
        name="SettingsMain"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
};

export default SettingsStack;
