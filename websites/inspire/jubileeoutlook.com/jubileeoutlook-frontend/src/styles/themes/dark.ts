import { createTheme } from '@mui/material/styles';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ffbd59',
      light: '#ffc970',
      dark: '#e6a94f',
    },
    secondary: {
      main: '#0078D4',
    },
    background: {
      default: '#000000',
      paper: '#1A1A1A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#CCCCCC',
      disabled: '#808080',
    },
    error: {
      main: '#D13438',
    },
    success: {
      main: '#107C10',
    },
    warning: {
      main: '#FF8C00',
    },
    divider: '#333333',
  },
  typography: {
    fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontSize: 13,
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: '#2A2A2A',
          color: '#FFFFFF',
          fontSize: '12px',
          border: '1px solid #444444',
        },
      },
    },
  },
});

export default darkTheme;
