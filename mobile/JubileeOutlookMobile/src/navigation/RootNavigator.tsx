/**
 * RootNavigator — Top-level navigator for JubileeOutlook Mobile.
 *
 * Switches between the Auth flow and the authenticated Main flow
 * based on the current authentication state from AuthContext.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { RootStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * RootNavigator renders either the Auth stack (sign-in) or the Main
 * tab navigator depending on whether the user is authenticated.
 * Shows a loading screen during bootstrap to prevent AuthStack flash.
 * NavigationContainer is provided by App.tsx.
 */
const RootNavigator: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Gate on isLoading: show branded loading screen while bootstrap resolves
  // tokens / sync-only state. Prevents returning users from seeing AuthStack flash.
  if (isLoading) {
    return <LoadingSpinner fullScreen message="Loading JubileeOutlook..." />;
  }

  return (
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
  );
};

export default RootNavigator;
