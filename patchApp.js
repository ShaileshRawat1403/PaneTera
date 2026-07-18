const fs = require('fs');

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Imports
const importsToAdd = `
import { useWorkbenchPreferences } from './hooks/useWorkbenchPreferences';
import { WorkbenchLayout } from './components/workbench/WorkbenchLayout';
import { WorkbenchEmptyState } from './components/workbench/WorkbenchEmptyState';
import { WorkbenchFailureState } from './components/workbench/WorkbenchFailureState';
import { LiveWorkbenchSurface } from './components/workbench/LiveWorkbenchSurface';
import { LiveWorkbenchToolbar } from './components/workbench/LiveWorkbenchToolbar';
`;

content = content.replace("import DeviceHubIcon from '@mui/icons-material/DeviceHub';", "import DeviceHubIcon from '@mui/icons-material/DeviceHub';\n" + importsToAdd);

// 2. Add local app hooks near the top of App component
const hookInsertStr = `
  const { prefs, setAppId, setLeftPanelWidth } = useWorkbenchPreferences();
  const [localAppStatus, setLocalAppStatus] = React.useState<string>('checking');
  const [localAppDef, setLocalAppDef] = React.useState<any>(null);

  React.useEffect(() => {
    if (prefs.activeAppId && workbenchMode === 'local-app') {
      setLocalAppStatus('checking');
      fetch(\`/api/workbench/apps/\${prefs.activeAppId}/status\`)
        .then(res => res.json())
        .then(data => {
          setLocalAppStatus(data.status);
          // Also fetch app definition from apps list
          return fetch('/api/workbench/apps');
        })
        .then(res => res ? res.json() : null)
        .then(data => {
          if (data && data.apps) {
            const def = data.apps.find((a: any) => a.appId === prefs.activeAppId);
            setLocalAppDef(def || null);
          }
        })
        .catch(err => {
          console.error(err);
          setLocalAppStatus('unavailable');
        });
    }
  }, [prefs.activeAppId, workbenchMode]);

  const handleSelectLocalApp = (appId: string) => {
    setAppId(appId);
  };
  
  const handleClearLocalApp = () => {
    setAppId(null);
    setLocalAppDef(null);
  };

  const handleReloadLocalApp = () => {
    // simple toggle to re-trigger effect
    setLocalAppStatus('checking');
    setTimeout(() => setAppId(prefs.activeAppId), 10);
  };
`;

content = content.replace("const App: React.FC = () => {", "const App: React.FC = () => {\n" + hookInsertStr);

// 3. Wrap main return layout
const layoutReturnStr = `  const mainWorkbenchContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#09090b', color: '#f8fafc', overflow: 'hidden' }}>
`;
content = content.replace("  return (\n    <ThemeProvider theme={codexTheme}>\n      <CssBaseline />", "  const mainWorkbenchContent = (\n    <>\n      <CssBaseline />");

content = content.replace("    </ThemeProvider>\n  );\n};\n\nexport default App;", "    </>\n  );\n\n  return (\n    <ThemeProvider theme={codexTheme}>\n      {workbenchMode === 'local-app' ? (\n        <WorkbenchLayout\n          leftPanelWidth={prefs.leftPanelWidth}\n          onWidthChange={setLeftPanelWidth}\n          renderLeft={mainWorkbenchContent}\n          renderRight={\n            !prefs.activeAppId ? (\n              <WorkbenchEmptyState onSelectApp={handleSelectLocalApp} />\n            ) : localAppStatus !== 'reachable' ? (\n              <WorkbenchFailureState status={localAppStatus} onRetry={handleReloadLocalApp} onClear={handleClearLocalApp} />\n            ) : (\n              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>\n                <LiveWorkbenchToolbar app={localAppDef} status={localAppStatus} onReload={handleReloadLocalApp} onClose={handleClearLocalApp} />\n                <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>\n                  {localAppDef && <LiveWorkbenchSurface app={localAppDef} status={localAppStatus} />}\n                </Box>\n              </Box>\n            )\n          }\n        />\n      ) : (\n        mainWorkbenchContent\n      )}\n    </ThemeProvider>\n  );\n};\n\nexport default App;");

fs.writeFileSync(path, content, 'utf8');
console.log('App.tsx patched');
