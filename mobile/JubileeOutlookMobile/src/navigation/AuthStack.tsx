/**
 * AuthStack — Authentication flow navigator.
 * Default landing: Sync Email (matching web frontend).
 * Screens: SyncEmail, SyncPassword, SignIn, SignUp, ForgotPassword.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { AuthStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import SyncEmailScreen from '../screens/auth/SyncEmailScreen';
import SyncPasswordScreen from '../screens/auth/SyncPasswordScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="SyncEmail"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="SyncEmail" component={SyncEmailScreen} />
      <Stack.Screen name="SyncPassword" component={SyncPasswordScreen} />
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
    </Stack.Navigator>
  );
};

export default AuthStack;
