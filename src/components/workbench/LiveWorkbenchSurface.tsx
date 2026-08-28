import React, { useRef, useState, useEffect } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { surface } from '../../theme/cssTokens';

// Instead of importing the server-side definition which might bring in fs/path, we define an inline matching interface.
export type LocalAppSandboxProfile = 'strict' | 'authenticated-local';
export interface LocalAppDefinitionClient {
  appId: string;
  name: string;
  url: string;
  description?: string;
  enabled: boolean;
  sandboxProfile: LocalAppSandboxProfile;
}

interface LiveWorkbenchSurfaceProps {
  app: LocalAppDefinitionClient;
  status: string;
}

export function resolveSandboxProfile(appUrl: string, profile: LocalAppSandboxProfile, portalOrigin: string): { sandbox: string, downgraded: boolean } {
  const sandboxFlags = profile === 'strict'
    ? "allow-scripts allow-forms"
    : "allow-scripts allow-forms allow-same-origin";

  let finalSandbox = sandboxFlags;
  let isDowngraded = false;
  
  try {
    const appOrigin = new URL(appUrl).origin;
    const isSameOrigin = portalOrigin === appOrigin;
    if (isSameOrigin && profile === 'authenticated-local') {
      finalSandbox = "allow-scripts allow-forms";
      isDowngraded = true;
    }
  } catch (e) {
    // Malformed URL, fallback to strict
    finalSandbox = "allow-scripts allow-forms";
  }

  return { sandbox: finalSandbox, downgraded: isDowngraded };
}

export const LiveWorkbenchSurface: React.FC<LiveWorkbenchSurfaceProps> = ({ app, status }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [downgraded, setDowngraded] = useState(false);
  const [safeSandbox, setSafeSandbox] = useState('');

  useEffect(() => {
    const result = resolveSandboxProfile(app.url, app.sandboxProfile, window.location.origin);
    setSafeSandbox(result.sandbox);
    setDowngraded(result.downgraded);
  }, [app.url, app.sandboxProfile]);

  return (
    <Box sx={{ width: '100%', height: '100%', bgcolor: surface.sunken, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      {downgraded && (
        <Alert severity="warning" sx={{ m: 2, fontSize: '0.8rem' }}>
          <strong>Same-origin authenticated embedding isn’t permitted. The app has been opened with the strict sandbox profile, so authentication or local storage features may be unavailable.</strong>
        </Alert>
      )}
      <Box sx={{ flexGrow: 1, minHeight: 0 }}>
        {safeSandbox && (
          <iframe
            ref={iframeRef}
            src={app.url}
            sandbox={safeSandbox}
            title={app.name}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              // eslint-disable-next-line no-restricted-syntax -- the local app paints its own ground
              backgroundColor: '#fff'
            }}
            allow="clipboard-read; clipboard-write"
          />
        )}
      </Box>
    </Box>
  );
};
