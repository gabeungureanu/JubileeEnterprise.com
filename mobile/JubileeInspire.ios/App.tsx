/**
 * Jubilee Inspire iOS
 *
 * The canonical iOS mobile client for the Jubilee Inspire ecosystem.
 * An Interactive AI Bible Experience for Deeper Understanding of Scripture.
 */

import React from 'react';
import { AppNavigator } from './src/navigation';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import { DrawerProvider } from './src/contexts/DrawerContext';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DrawerProvider>
          <AppNavigator />
        </DrawerProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
