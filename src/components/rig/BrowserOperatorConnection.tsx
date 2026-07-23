import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExtensionIcon from '@mui/icons-material/Extension';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import { accent, ink, radius, status, surface, typography } from '../../theme/tokens';
import { requestBrowserOperatorStatus } from '../../utils/browserOperatorBridge';

interface BrowserSessionSummary {
  sessionId: string;
  runtimeId: string;
  installationId: string;
  pairedAt: string | null;
}

interface BrowserStatus {
  gateway: 'current';
  pending: boolean;
  sessions: BrowserSessionSummary[];
}

interface Props {
  token: string;
}

const UI_SOURCE = 'panetera-ui';
const OPERATOR_SOURCE = 'panetera-browser-operator';
const BRIDGE_RELOAD_KEY = 'panetera-bridge-reload-attempted';

async function browserRequest<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Browser connection failed (${response.status}).`);
  }
  return payload as T;
}

function shortIdentity(value: string): string {
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

export function BrowserOperatorConnection({ token }: Props): React.ReactElement {
  const [browserStatus, setBrowserStatus] = useState<BrowserStatus | null>(null);
  const [extensionDetected, setExtensionDetected] = useState(false);
  const [extensionPaired, setExtensionPaired] = useState(false);
  const [offerDelivered, setOfferDelivered] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ severity: 'error' | 'info'; text: string } | null>(null);
  const pairingCodeRef = useRef<string | null>(null);
  const offeredPairingCodeRef = useRef<string | null>(null);

  const loadStatus = useCallback(async () => {
    const [value, operatorStatus] = await Promise.all([
      browserRequest<BrowserStatus>(token, '/api/browser/pairing/status'),
      requestBrowserOperatorStatus(),
    ]);
    setBrowserStatus(value);
    setExtensionDetected(operatorStatus.extensionAvailable);
    setExtensionPaired(operatorStatus.paired);
    if (value.sessions.length > 0 && operatorStatus.paired) {
      pairingCodeRef.current = null;
      offeredPairingCodeRef.current = null;
      setPairingCode(null);
      setOfferDelivered(false);
    } else if (!value.pending && pairingCodeRef.current) {
      pairingCodeRef.current = null;
      offeredPairingCodeRef.current = null;
      setPairingCode(null);
      setOfferDelivered(false);
      setNotice({ severity: 'info', text: 'The connection request expired. Start a new one when you are ready.' });
    }
  }, [token]);

  const offerToExtension = useCallback((code: string) => {
    // Status checks also produce READY handshakes. Without a per-code guard,
    // the pairing poll reopened the extension approval page every 1.5 seconds.
    if (offeredPairingCodeRef.current === code) return;
    offeredPairingCodeRef.current = code;
    window.postMessage({
      source: UI_SOURCE,
      type: 'PAIRING_OFFER',
      code,
      nonce: crypto.randomUUID(),
    }, window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      const message = event.data as Record<string, unknown> | null;
      if (!message || message.source !== OPERATOR_SOURCE) return;
      if (message.type === 'READY') {
        window.sessionStorage.removeItem(BRIDGE_RELOAD_KEY);
        setExtensionDetected(true);
        if (pairingCodeRef.current) offerToExtension(pairingCodeRef.current);
      }
      if (message.type === 'RELOAD_REQUIRED') {
        if (!window.sessionStorage.getItem(BRIDGE_RELOAD_KEY)) {
          window.sessionStorage.setItem(BRIDGE_RELOAD_KEY, 'true');
          window.location.reload();
          return;
        }
        setExtensionDetected(false);
        setNotice({ severity: 'error', text: 'Chrome reloaded the extension, but its page bridge did not recover. Reload this page once.' });
      }
      if (message.type === 'PAIRING_OFFER_RESULT' && message.success === true) {
        setExtensionDetected(true);
        setOfferDelivered(true);
      }
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ source: UI_SOURCE, type: 'PING', nonce: crypto.randomUUID() }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [offerToExtension]);

  useEffect(() => {
    void loadStatus().catch((error: Error) => setNotice({ severity: 'error', text: error.message }));
  }, [loadStatus]);

  useEffect(() => {
    if (!pairingCode) return undefined;
    const timer = window.setInterval(() => {
      void loadStatus().catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [loadStatus, pairingCode]);

  const startConnection = async () => {
    setBusy(true);
    setNotice(null);
    setShowFallback(false);
    try {
      const result = await browserRequest<{ code: string; expiresAt: string }>(token, '/api/browser/pairing/start', { method: 'POST' });
      pairingCodeRef.current = result.code;
      offeredPairingCodeRef.current = null;
      setPairingCode(result.code);
      setExpiresAt(result.expiresAt);
      setOfferDelivered(false);
      offerToExtension(result.code);
      setNotice({
        severity: 'info',
        // Detection and the offer reply are asynchronous. Branching on the
        // render-time value could say "not detected" beside an Extension found
        // chip when READY arrived between the click and this state update.
        text: 'Approve the connection in the PaneTera Browser Operator tab. If Chrome did not open it, use the pairing code below.',
      });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (sessionId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await browserRequest(token, `/api/browser/pairing/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
      await loadStatus();
      setNotice({ severity: 'info', text: 'Browser connection revoked. The extension will ask to connect again.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const cancelPairing = async () => {
    setBusy(true);
    try {
      await browserRequest(token, '/api/browser/pairing/pending', { method: 'DELETE' });
      window.postMessage({ source: UI_SOURCE, type: 'PAIRING_CANCEL', nonce: crypto.randomUUID() }, window.location.origin);
      pairingCodeRef.current = null;
      offeredPairingCodeRef.current = null;
      setPairingCode(null);
      setOfferDelivered(false);
      setShowFallback(false);
      setNotice({ severity: 'info', text: 'Connection request cancelled.' });
    } catch (error: unknown) {
      setNotice({ severity: 'error', text: error instanceof Error ? error.message : String(error) });
    } finally {
      setBusy(false);
    }
  };

  const sessions = browserStatus?.sessions ?? [];
  const connected = sessions.length > 0 && extensionPaired;

  return (
    <Box
      component="section"
      aria-labelledby="browser-operator-title"
      sx={{ border: `1px solid ${surface.border}`, borderRadius: `${radius.md}px`, overflow: 'hidden', backgroundColor: surface.raised }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={2} sx={{ p: 1.75 }}>
        <Stack direction="row" gap={1.25} sx={{ minWidth: 0 }}>
          <Box sx={{ mt: 0.25, color: connected ? status.neutral : accent.violet }}><ExtensionIcon fontSize="small" /></Box>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
              <Typography id="browser-operator-title" variant="subtitle1" sx={{ fontWeight: 650 }}>Browser Operator</Typography>
              <Chip
                size="small"
                label={connected ? 'Connected' : extensionDetected ? 'Extension found' : 'Not connected'}
                variant="outlined"
                sx={{ color: connected ? status.neutral : ink.secondary, borderColor: surface.border }}
              />
            </Stack>
            <Typography variant="body2" sx={{ color: ink.secondary, mt: 0.5, lineHeight: 1.55 }}>
              Bring the active webpage into PaneTera as untrusted, auditable evidence. Page actions remain approval-gated.
            </Typography>
          </Box>
        </Stack>
        <Button
          variant={connected ? 'outlined' : 'contained'}
          size="small"
          disabled={busy || Boolean(pairingCode)}
          onClick={connected ? () => void loadStatus() : startConnection}
          startIcon={connected ? <RefreshIcon /> : undefined}
          sx={{ flexShrink: 0 }}
        >
          {connected ? 'Refresh' : pairingCode ? 'Waiting' : 'Connect'}
        </Button>
      </Stack>

      <Divider />
      <Box sx={{ p: 1.75, backgroundColor: surface.sunken }}>
        {notice && <Alert severity={notice.severity} sx={{ mb: 1.5 }}>{notice.text}</Alert>}

        {pairingCode && !connected && (
          <Box sx={{ mb: 1.5 }}>
            <Stack direction="row" alignItems="center" gap={1} sx={{ color: offerDelivered ? status.neutral : status.brass }}>
              {offerDelivered ? <CheckCircleOutlineIcon fontSize="small" /> : <OpenInNewIcon fontSize="small" />}
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {offerDelivered ? 'Approval page opened in Chrome' : 'Open the extension to approve'}
              </Typography>
            </Stack>
            <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mt: 0.5 }}>
              Use the dedicated Chrome tab to allow or decline this connection. This request expires {expiresAt ? new Date(expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'in two minutes'}.
            </Typography>
            <Stack direction="row" gap={0.5} sx={{ mt: 0.75 }}>
              <Button size="small" onClick={() => setShowFallback((value) => !value)}>
                {showFallback ? 'Hide pairing code' : 'Use pairing code instead'}
              </Button>
              <Button size="small" color="inherit" disabled={busy} onClick={cancelPairing}>Cancel request</Button>
            </Stack>
            <Collapse in={showFallback} unmountOnExit>
              <Stack direction="row" alignItems="center" gap={1} sx={{ mt: 1, p: 1.25, border: `1px solid ${surface.border}`, borderRadius: `${radius.sm}px` }}>
                <Typography sx={{ fontFamily: typography.mono, fontWeight: 650, letterSpacing: '0.12em', flexGrow: 1 }}>{pairingCode}</Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon />}
                  onClick={() => void navigator.clipboard.writeText(pairingCode).then(
                    () => setNotice({ severity: 'info', text: 'Pairing code copied.' }),
                    () => setNotice({ severity: 'error', text: 'Could not copy. Select the code manually.' }),
                  )}
                >
                  Copy
                </Button>
              </Stack>
            </Collapse>
          </Box>
        )}

        {connected ? (
          <Stack spacing={1}>
            {sessions.map((session) => (
              <Stack key={session.sessionId} direction="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2">Chrome on this device</Typography>
                  <Typography variant="caption" sx={{ color: ink.secondary, fontFamily: typography.mono }}>
                    {shortIdentity(session.installationId)} · {session.pairedAt ? `connected ${new Date(session.pairedAt).toLocaleString()}` : 'connected'}
                  </Typography>
                </Box>
                <Button color="error" size="small" disabled={busy} onClick={() => revoke(session.sessionId)}>Revoke</Button>
              </Stack>
            ))}
          </Stack>
        ) : !pairingCode ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} divider={<Divider flexItem orientation="vertical" />}>
            <Typography variant="caption" sx={{ color: ink.secondary }}>Observe the active page</Typography>
            <Typography variant="caption" sx={{ color: ink.secondary }}>Extract articles, tables, links, and metadata</Typography>
            <Typography variant="caption" sx={{ color: ink.secondary }}>Revoke from Rig or Chrome</Typography>
          </Stack>
        ) : null}
      </Box>
    </Box>
  );
}
