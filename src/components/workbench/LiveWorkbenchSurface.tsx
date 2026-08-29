import React, { useRef, useState, useEffect } from 'react';
import { Box, Typography, Alert } from '@mui/material';
import { ink, surface } from '../../theme/cssTokens';

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
      {/*
        Guide mode.

        This claim used to live in LiveWorkbenchToolbar, which the shared
        SurfaceHeader replaced. It is not chrome and it is not a status -- it is
        a statement about what PaneTera can do to the thing in this frame, and
        losing it in a layout change would have quietly removed the only place
        the boundary is stated. It belongs with the sandbox notice below, since
        both describe the terms the embedded application is running under.

        It is also what the header's empty governed zone means in words: every
        action offered for a local app is 'local-ui', so nothing here can reach
        inside the application.
      */}
      <Box
        sx={{
          px: 2,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderBottom: `1px solid ${surface.border}`,
        }}
      >
        <Typography
          variant="caption"
          sx={{ color: ink.muted, fontSize: '0.6875rem' }}
        >
          Guide mode — PaneTera observes this application. It does not act inside it.
        </Typography>
      </Box>

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
