// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App';
import { paneteraThemes } from './theme/paneteraTheme';
import { ThemeModeContext, useThemeModeController } from './theme/themeMode';
import './index.css';

// The theme is mounted once here so every component inherits the contract's
// design language. Components written before the theme existed keep their own
// literals until they are migrated; they now sit on the correct palette rather
// than fighting it.
function PaneTeraRoot() {
  const themeMode = useThemeModeController();

  return (
    <ThemeModeContext.Provider value={themeMode}>
      <ThemeProvider theme={paneteraThemes[themeMode.mode]}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <PaneTeraRoot />
  </React.StrictMode>
);
