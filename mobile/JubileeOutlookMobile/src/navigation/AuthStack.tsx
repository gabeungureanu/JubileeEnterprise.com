/**
 * AuthStack — Authentication flow navigator.
 *
 * Contains the sign-in screen. Additional auth screens (e.g. forgot
 * password, MFA) can be added here as the auth flow expands.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { AuthStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import SignInScreen from '../screens/SignInScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

/**
 * AuthStack renders the authentication screens with no visible header
 * and a dark background matching the app theme.
 */
const AuthStack: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
    </Stack.Navigator>
  );
};

export default AuthStack;
