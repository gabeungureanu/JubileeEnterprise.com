import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppProvider } from './context/AppContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/common/Toast';
import AppLayout from './components/layout/AppLayout';
import SignIn from './pages/Auth/SignIn';
import darkTheme from './styles/themes/dark';
import './styles/global.css';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <SignIn />;
  }

  return (
    <AppProvider>
      <ToastProvider>
        <AppLayout />
      </ToastProvider>
    </AppProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
