// src/theme.js

import { createTheme } from '@mui/material/styles';

/**
 * This file defines the custom color palette and theme for the application.
 * It uses Material-UI's createTheme function to ensure consistency
 * across all components.
 */
const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2', // A strong, professional blue
    },
    secondary: {
      main: '#d32f2f', // A clear, attention-grabbing red
    },
    background: {
      default: '#f4f6f8', // A very light grey for the background
      paper: '#ffffff', // White for surfaces like cards and tables
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
    h5: {
      fontWeight: 600,
    },
  },
});

export default theme;