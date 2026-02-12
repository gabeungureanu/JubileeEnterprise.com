import React from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AppProvider } from './context/AppContext';
import AppLayout from './components/layout/AppLayout';
import darkTheme from './styles/themes/dark';
import './styles/global.css';

const App: React.FC = () => {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AppProvider>
        <AppLayout />
      </AppProvider>
    </ThemeProvider>
  );
};

export default App;
