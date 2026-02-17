/**
 * RootNavigator — Top-level navigator for JubileeOutlook Mobile.
 *
 * Switches between the Auth flow and the authenticated Main flow
 * based on the current authentication state from AuthContext.
 */
import React from 'react';
import { NavigationContainer, DefaultTheme, Theme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Dark theme configuration matching the JubileeOutlook web frontend.
 */
const JubileeDarkTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    notification: Colors.accent,
  },
};

/**
 * RootNavigator renders either the Auth stack (sign-in) or the Main
 * tab navigator depending on whether the user is authenticated.
 */
const RootNavigator: React.FC = () => {
  const { isAuthenticated } = useAuth();

  return (
    <NavigationContainer theme={JubileeDarkTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'fade',
        }}
      >
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default RootNavigator;
