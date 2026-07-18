const fs = require('fs');

const path = 'src/App.tsx';
let content = fs.readFileSync(path, 'utf8');

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

// Remove the old hook insertion from the top
content = content.replace(hookInsertStr, "");

// Find workbenchMode definition and insert the hooks right after it
const modeDef = `  const [workbenchMode, setWorkbenchMode] = useState<WorkbenchMode>(() => {
    const stored = localStorage.getItem('portal-workbench-mode');
    return (stored as WorkbenchMode) || 'native-focus';
  });`;

content = content.replace(modeDef, modeDef + "\n" + hookInsertStr);

fs.writeFileSync(path, content, 'utf8');
console.log('App.tsx fixed');
