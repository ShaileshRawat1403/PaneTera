// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { paneteraTheme } from './theme/paneteraTheme';
import './index.css';

// The theme is mounted once here so every component inherits the contract's
// design language. Components written before the theme existed keep their own
// literals until they are migrated; they now sit on the correct palette rather
// than fighting it.
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <ThemeProvider theme={paneteraTheme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
