import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, CardActionArea, Grid, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Paper, Divider, TextField, Button, Chip, Stack, Tabs, Tab } from '@mui/material';
import type { UiComponent } from '../../shared/uiComponent';
import FolderIcon from '@mui/icons-material/Folder';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import { ProposedActionCard } from './ProposedActionCard';
import { RepoSetupProposalCard } from './RepoSetupProposalCard';
import { LiveAppWorkbenchCard } from './LiveAppWorkbenchCard';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import InfoIcon from '@mui/icons-material/Info';
import LaptopMacIcon from '@mui/icons-material/LaptopMac';
import { NativeWorkbenchRenderer } from './nativeWorkbench/NativeWorkbenchRenderer';
import { BrowserObservationView } from './nativeWorkbench/BrowserObservationView';
import { BrowserExtractionView } from './nativeWorkbench/BrowserExtractionView';
import { WorkspacesCatalog } from './nativeWorkbench/WorkspacesCatalog';
import { accent, ink, radius, status, surface, typography } from '../theme/cssTokens';
import { AgentRunLiveCard } from './workbench/AgentRunLiveCard';
import { SchemaCardRenderer } from './schema/SchemaCardRenderer';
interface ComponentProps {
  uiComponent: UiComponent;
  onAction: (query: string) => void;
  onApproveAction?: (id: string, workspaceName: string, command: string) => void;
  onCancelAction?: (id: string) => void;
  onApproveBrowserAction?: (runId: string) => void;
  onRejectBrowserAction?: (runId: string) => void;
  onStartContentWorkflow?: (form: any) => void;
  /** Route a finished run's canvas artifact (e.g. a fetched page) to the host. */
  onRunArtifact?: (artifact: { type: string; data?: Record<string, unknown> }) => void;
  activeLens?: string;
  variant?: 'feed' | 'main' | 'chat' | 'native-plane' | 'live-plane';
  token?: string;
}

function ResolutionNotice({ kind, children }: { kind: 'success' | 'danger'; children: React.ReactNode }) {
  const colour = kind === 'success' ? status.success : status.danger;
  const backgroundColor = kind === 'success' ? status.successMuted : status.dangerMuted;
  return (
    <Box
      role={kind === 'danger' ? 'alert' : 'status'}
      sx={{ mt: 2, mb: 1, p: 1.5, borderRadius: `${radius.sm}px`, backgroundColor, border: `1px solid ${colour}` }}
    >
      <Typography variant="body2" sx={{ color: colour, fontWeight: 600 }}>{children}</Typography>
    </Box>
  );
}

export const InteractiveComponent: React.FC<ComponentProps> = ({ uiComponent, onAction, onApproveAction, onCancelAction, onApproveBrowserAction, onRejectBrowserAction, onStartContentWorkflow, onRunArtifact, activeLens, variant = 'main', token = '' }) => {
  const { type, data } = uiComponent;
  // Local only — the message log itself stays append-only/immutable, so
  // "did I already act on this" lives here rather than mutating history.
  const [resolution, setResolution] = useState<'pending' | 'approved' | 'cancelled'>('pending');
  const [activeTab, setActiveTab] = useState<'native' | 'live'>('native');
  const [activeRouteId, setActiveRouteId] = useState<string>('dashboard');
  const [iframeSrc, setIframeSrc] = useState<string>('');

  React.useEffect(() => {
    if (data?.embedUrl) {
      setIframeSrc(data.embedUrl);
    }
  }, [data?.embedUrl]);

  if (type === 'LiveAppWorkbench' && data) {
    if (resolution === 'cancelled') {
      return (
        <ResolutionNotice kind="danger">Proposal rejected.</ResolutionNotice>
      );
    }
    return (
      <LiveAppWorkbenchCard
        variant="chat"
        data={data}
        onCancel={() => setResolution('cancelled')}
        activeLens={activeLens}
      />
    );
  }

  if (type === 'RepoSetupProposal' && data) {
    if (resolution === 'cancelled') {
      return (
        <ResolutionNotice kind="danger">Proposal rejected.</ResolutionNotice>
      );
    }
    return (
      <RepoSetupProposalCard
        variant="chat"
        data={data}
        onCancel={() => setResolution('cancelled')}
      />
    );
  }

  if (type === 'ProposedAction' && data) {
    const { workspaceName, command, procId, reason } = data;

    if (variant === 'feed' || variant === 'chat') {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 600 }}>
            Proposed Action ({workspaceName})
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: typography.mono, color: status.brass, wordBreak: 'break-all' }}>
            {command}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, flexWrap: 'wrap' }}>
            <Chip label={`Risk: ${data.riskLevel || 'safe'}`} size="small" sx={{ height: 18, fontSize: '0.65rem', backgroundColor: surface.sunken, color: ink.secondary }} />
            {data.isDryRun && <Chip label="Dry run" size="small" sx={{ height: 18, fontSize: '0.65rem', backgroundColor: accent.violetMuted, color: accent.violet }} />}
          </Stack>
        </Box>
      );
    }

    if (resolution === 'approved') {
      return (
        <ResolutionNotice kind="success">Approved — running now. Watch the canvas for output and evidence.</ResolutionNotice>
      );
    }
    if (resolution === 'cancelled') {
      return (
        <ResolutionNotice kind="danger">Cancelled — nothing ran.</ResolutionNotice>
      );
    }
    return (
      <ProposedActionCard
        variant="chat"
        workspaceName={workspaceName}
        command={command}
        reason={reason}
        riskLevel={data.riskLevel}
        executionMode={data.executionMode}
        isDryRun={data.isDryRun}
        allowed={data.allowed}
        description={data.description}
        onApprove={() => {
          if (procId && onApproveAction) {
            onApproveAction(procId, workspaceName, command);
          }
          setResolution('approved');
        }}
        onCancel={() => {
          if (procId && onCancelAction) {
            onCancelAction(procId);
          }
          setResolution('cancelled');
        }}
      />
    );
  }

  if (type === 'WorkspaceList' && Array.isArray(data)) {
    return (
      <Box sx={{ mt: 2, mb: 1 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>
          Select a project to explore:
        </Typography>
        <Grid container spacing={2}>
          {data.map((ws: any, idx: number) => (
            <Grid item xs={12} sm={6} key={idx}>
              <Card sx={{ backgroundColor: surface.raised, border: `1px solid ${surface.border}` }}>
                <CardActionArea onClick={() => onAction(`List files in ${ws.name}`)}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <FolderIcon color="primary" sx={{ mr: 1 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: '600' }}>
                        {ws.name}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {ws.path}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (type === 'FileList' && data) {
    const { workspace, files } = data;
    return (
      <Box sx={{ mt: 2, mb: 1 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>
          Files in {workspace}
        </Typography>
        <Paper variant="outlined" sx={{ maxHeight: 250, overflowY: 'auto', backgroundColor: surface.sunken, borderColor: surface.border }}>
          <List dense>
            {files.slice(0, 100).map((file: string, idx: number) => (
              <ListItem key={idx} disablePadding>
                <ListItemButton onClick={() => onAction(`Read file ${file} in ${workspace}`)}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    <InsertDriveFileIcon fontSize="small" sx={{ color: ink.secondary }} />
                  </ListItemIcon>
                  <ListItemText 
                    primary={file} 
                    primaryTypographyProps={{ variant: 'body2', sx: { fontFamily: typography.mono, color: ink.primary } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Paper>
        {files.length > 100 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Showing first 100 of {files.length} files. Use search to find specific items.
          </Typography>
        )}
      </Box>
    );
  }

  if (type === 'CodePreview' && data) {
    const { workspace, path: filePath, content } = data;
    return (
      <Box sx={{ mt: 2, mb: 1, width: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: surface.raised, p: 1, borderTopLeftRadius: radius.sm, borderTopRightRadius: radius.sm, borderBottom: `1px solid ${surface.border}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CodeIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
            <Typography variant="caption" sx={{ fontFamily: typography.mono, fontWeight: 600, color: ink.primary }}>
              {workspace} / {filePath}
            </Typography>
          </Box>
        </Box>
        <Paper 
          variant="outlined" 
          sx={{ 
            p: 1.5, 
            backgroundColor: surface.sunken,
            borderColor: surface.border,
            borderTopLeftRadius: 0, 
            borderTopRightRadius: 0,
            overflowX: 'auto' 
          }}
        >
          <Typography 
            component="pre" 
            variant="body2" 
            sx={{ 
              fontFamily: typography.mono,
              fontSize: '0.8rem', 
              color: ink.primary,
              whiteSpace: 'pre',
              margin: 0
            }}
          >
            {content}
          </Typography>
        </Paper>
      </Box>
    );
  }

  if (type === 'SearchResults' && data) {
    const { workspace, keyword, results } = data;
    return (
      <Box sx={{ mt: 2, mb: 1 }}>
        <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 'bold' }}>
          Matches for &quot;{keyword}&quot; in {workspace}:
        </Typography>
        <List dense sx={{ width: '100%' }}>
          {results.map((res: any, idx: number) => (
            <Paper key={idx} sx={{ p: 1.5, mb: 1.5, backgroundColor: surface.raised, borderColor: surface.border }} variant="outlined">
              <Box 
                sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer', mb: 1 }}
                onClick={() => onAction(`Read file ${res.file} in ${workspace}`)}
              >
                <SearchIcon fontSize="small" sx={{ mr: 1, color: accent.violet }} />
                <Typography variant="body2" sx={{ fontFamily: typography.mono, fontWeight: 600, textDecoration: 'underline', color: ink.primary }}>
                  {res.file}
                </Typography>
              </Box>
              <Divider sx={{ my: 0.5, borderColor: surface.border }} />
              {res.matches.map((match: string, matchIdx: number) => (
                <Typography 
                  key={matchIdx} 
                  variant="caption" 
                  component="div" 
                  sx={{ 
                    fontFamily: typography.mono,
                    color: ink.secondary,
                    pl: 2, 
                    py: 0.25,
                    borderLeft: `2px solid ${surface.borderStrong}`,
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {match}
                </Typography>
              ))}
            </Paper>
          ))}
        </List>
      </Box>
    );
  }

  if (type === 'WorkspacesCatalog' && data) {
    return <WorkspacesCatalog data={data} />;
  }

  if (type === 'WorkflowsList' && data) {
    const { source, workflows, error } = data;

    return (
      <Box sx={{ mt: 2, mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 'bold' }}>
            {source === 'flowright' ? 'Flowright Governed Workflows' : 'Soothsayer Live Workflows Preview'}
          </Typography>
          <Chip
            label={source === 'flowright' ? 'Governed Kernel' : 'Preview Only'}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              backgroundColor: source === 'flowright' ? accent.violetMuted : status.brassMuted,
              color: source === 'flowright' ? accent.violet : status.brass,
              border: `1px solid ${source === 'flowright' ? accent.violetBorder : status.brass}`
            }}
          />
        </Box>

        {error ? (
          <Paper role="alert" variant="outlined" sx={{ p: 2, backgroundColor: status.dangerMuted, borderColor: status.danger, borderRadius: `${radius.sm}px` }}>
            <Typography variant="body2" sx={{ color: status.danger, fontWeight: 600 }}>
              {error}
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {workflows.map((wf: any, idx: number) => (
              <Grid item xs={12} key={idx}>
                <Card sx={{ backgroundColor: surface.raised, border: `1px solid ${surface.border}` }}>
                  <CardContent sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: ink.primary }}>
                        {wf.name}
                      </Typography>
                      <Chip
                        label={wf.previewOnly ? 'PREVIEW ONLY' : 'RUNNABLE'}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.55rem',
                          fontWeight: 700,
                          backgroundColor: wf.previewOnly ? status.brassMuted : surface.sunken,
                          color: wf.previewOnly ? status.brass : ink.secondary,
                          border: `1px solid ${wf.previewOnly ? status.brass : surface.border}`
                        }}
                      />
                    </Box>

                    <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 1 }}>
                      {wf.description}
                    </Typography>

                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5 }}>
                        Inputs required
                      </Typography>
                      {wf.inputs && wf.inputs.length > 0 ? (
                        <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                          {wf.inputs.map((inp: any, iIdx: number) => (
                            <Chip
                              key={iIdx}
                              label={typeof inp === 'string' ? inp : inp.name}
                              size="small"
                              sx={{ height: 18, fontSize: '0.65rem', fontFamily: typography.mono, backgroundColor: surface.sunken, color: ink.secondary }}
                            />
                          ))}
                        </Stack>
                      ) : (
                        <Typography variant="caption" sx={{ color: ink.muted, fontStyle: 'italic' }}>
                          None
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      {!wf.previewOnly && wf.id === 'websiteops.website_content_publish.v0' ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => onAction('write a blog')}
                          sx={{ backgroundColor: accent.violet, color: ink.onAccent, textTransform: 'none', fontWeight: 650, borderRadius: `${radius.sm}px`, '&:hover': { backgroundColor: accent.violetHover } }}
                        >
                          Open ContentOps starter
                        </Button>
                      ) : (
                        <Button
                          size="small"
                          variant="outlined"
                          disabled
                          sx={{ color: ink.disabled, borderColor: surface.border, textTransform: 'none', borderRadius: `${radius.sm}px` }}
                        >
                          Preview only
                        </Button>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
    );
  }

  if (type === 'ContentOpsStarter' && data) {
    const { schema, siteGoal: initSiteGoal, contentBrief: initContentBrief, targetPages: initTargetPages, publishConstraints, schemaSource } = data;
    
    const [siteGoal, setSiteGoal] = useState(initSiteGoal || '');
    const [targetPages, setTargetPages] = useState(initTargetPages || '');
    const [contentBrief, setContentBrief] = useState(initContentBrief || '');
    const [busy, setBusy] = useState(false);

    const isFormValid = siteGoal.trim() !== '' && targetPages.trim() !== '' && contentBrief.trim() !== '';

    const handleStart = async () => {
      if (!isFormValid || busy) return;
      setBusy(true);
      if (onStartContentWorkflow) {
        await onStartContentWorkflow({
          siteGoal,
          targetPages,
          contentBrief,
          sourceMaterial: '',
          seoRequirements: '',
          publishConstraints
        });
      }
      setBusy(false);
    };

    return (
      <Paper variant="outlined" sx={{ p: 3, backgroundColor: surface.raised, borderColor: surface.border, borderRadius: `${radius.md}px` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2" sx={{ color: accent.violet, fontWeight: 650, letterSpacing: '0.03em' }}>
            Content workflow
          </Typography>
          <Chip label={`Schema: ${schemaSource || 'local template'}`} size="small" sx={{ height: 20, fontSize: '0.65rem', backgroundColor: accent.violetMuted, color: accent.violet }} />
        </Box>

        <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 3, lineHeight: 1.5 }}>
          Create and dry-run a content generation and validation run using the dynamic schema definition below. Action is approval-gated; publishing requires manual execution outside the loop.
        </Typography>

        <Stack spacing={2.5}>
          {schema.inputs.map((input: any) => {
            let val = '';
            let onChange = (e: any) => {};
            if (input.name === 'siteGoal') {
              val = siteGoal;
              onChange = (e: any) => setSiteGoal(e.target.value);
            } else if (input.name === 'targetPages') {
              val = targetPages;
              onChange = (e: any) => setTargetPages(e.target.value);
            } else if (input.name === 'contentBrief') {
              val = contentBrief;
              onChange = (e: any) => setContentBrief(e.target.value);
            }

            return (
              <TextField
                key={input.name}
                label={input.label}
                value={val}
                onChange={onChange}
                size="small"
                fullWidth
                required={input.required}
                multiline={input.name !== 'targetPages'}
                minRows={input.name === 'contentBrief' ? 3 : 2}
                placeholder={input.description}
                helperText={input.description}
                FormHelperTextProps={{ sx: { color: ink.muted, fontSize: '0.7rem' } }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    backgroundColor: surface.sunken,
                    '& fieldset': { borderColor: surface.border }
                  },
                  '& .MuiInputLabel-root': { color: ink.secondary }
                }}
              />
            );
          })}

          <Box>
            <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 0.5 }}>
              Publishing constraints
            </Typography>
            <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: surface.sunken, borderColor: surface.border }}>
              <Typography variant="caption" sx={{ fontFamily: typography.mono, color: ink.secondary, display: 'block' }}>
                {publishConstraints}
              </Typography>
            </Paper>
          </Box>

          <Button
            variant="contained"
            disabled={!isFormValid || busy}
            onClick={handleStart}
            sx={{
              backgroundColor: accent.violet,
              color: ink.onAccent,
              fontWeight: 650,
              textTransform: 'none',
              borderRadius: `${radius.sm}px`,
              mt: 1,
              '&:hover': { backgroundColor: accent.violetHover }
            }}
          >
            {busy ? 'Starting run...' : 'Start governed run'}
          </Button>
        </Stack>
      </Paper>
    );
  }

  if (type === 'SoothsayerWorkbench' && data) {
    const { url, manifestAvailable, environment, version, routes, features, workflows = [], health, workbench, workbenchError } = data;
    const view = workbench?.views?.[0] || null;
    const draft = view?.data || {};
    const healthStatus = typeof health?.status === 'string' ? health.status : 'unknown';

    if (variant === 'live-plane') {
      const liveEnabled = data.embed?.allowed && data.embedUrl;
      return (
        <Paper
          variant="outlined"
          sx={{
            height: '100%',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: surface.base,
            borderColor: surface.border,
            borderRadius: 0,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2,
              py: 1.5,
              borderBottom: `1px solid ${surface.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              flexShrink: 0,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" sx={{ color: accent.violet, fontWeight: 650, letterSpacing: '0.06em', display: 'block' }}>
                Live application
              </Typography>
              <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 650, lineHeight: 1.2 }}>
                Soothsayer
              </Typography>
              <Typography variant="caption" sx={{ color: ink.muted, wordBreak: 'break-all', fontFamily: typography.mono }}>
                {url}
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon sx={{ fontSize: 12 }} />}
              sx={{ borderColor: surface.borderStrong, color: ink.secondary, borderRadius: `${radius.sm}px`, flexShrink: 0 }}
            >
              Open
            </Button>
          </Box>

          {liveEnabled ? (
            <>
              {Array.isArray(data.embed.routes) && data.embed.routes.length > 0 && (
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{
                    px: 2,
                    py: 1.25,
                    borderBottom: `1px solid ${surface.border}`,
                    flexWrap: 'wrap',
                    flexShrink: 0,
                  }}
                  useFlexGap
                >
                  {data.embed.routes.map((route: any) => {
                    const isSelected = activeRouteId === route.id;
                    return (
                      <Chip
                        key={route.id}
                        label={route.label}
                        onClick={() => {
                          setActiveRouteId(route.id);
                          if (route.embedUrl) {
                            setIframeSrc(route.embedUrl);
                          }
                        }}
                        variant={isSelected ? 'filled' : 'outlined'}
                        size="small"
                        sx={{
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          height: 26,
                          backgroundColor: isSelected ? accent.violet : 'transparent',
                          color: isSelected ? ink.onAccent : ink.secondary,
                          borderColor: isSelected ? accent.violet : surface.borderStrong,
                        }}
                      />
                    );
                  })}
                </Stack>
              )}
              <Box sx={{ flexGrow: 1, minHeight: 0, backgroundColor: surface.sunken }}>
                <iframe
                  src={iframeSrc || data.embedUrl}
                  title="Live Soothsayer"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
                />
              </Box>
            </>
          ) : (
            <Box sx={{ p: 3 }}>
              <Typography role="status" variant="body2" sx={{ color: status.brass, fontWeight: 650, mb: 1 }}>
                Live embed is not configured.
              </Typography>
              <Typography variant="caption" sx={{ color: ink.secondary, lineHeight: 1.6 }}>
                The app workbench is available, but PaneTera did not receive an approved live application URL.
              </Typography>
            </Box>
          )}
        </Paper>
      );
    }

    if (variant === 'feed' || variant === 'chat') {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="body2" sx={{ color: ink.primary, fontWeight: 600 }}>
            Soothsayer Workbench ({environment || 'production'})
          </Typography>
          <Typography variant="caption" sx={{ color: ink.muted, wordBreak: 'break-all', fontFamily: typography.mono }}>
            {url}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ mt: 0.5, flexWrap: 'wrap' }}>
            <Chip 
              label={manifestAvailable ? "Manifest Active" : "No Manifest"} 
              size="small" 
              sx={{ 
                height: 16, 
                fontSize: '0.6rem', 
                backgroundColor: manifestAvailable ? surface.sunken : status.dangerMuted,
                color: manifestAvailable ? ink.secondary : status.danger
              }} 
            />
            <Chip label={`Workflows: ${workflows.length}`} size="small" sx={{ height: 18, fontSize: '0.65rem', backgroundColor: surface.sunken, color: ink.secondary }} />
          </Stack>
        </Box>
      );
    }

    return (
      <Paper
        variant="outlined"
        sx={{
          backgroundColor: surface.raised,
          borderColor: surface.border,
          borderRadius: `${radius.lg}px`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Main App Bar Header */}
        <Box
          sx={{
            p: 2,
            backgroundColor: surface.overlay,
            borderBottom: `1px solid ${surface.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <LaptopMacIcon color="primary" sx={{ fontSize: 20 }} />
            <Typography variant="body1" sx={{ fontWeight: 650, color: ink.primary, letterSpacing: '0.03em' }}>
              Soothsayer workbench
            </Typography>
            <Chip
              label={manifestAvailable ? (view ? 'APP MANIFEST' : 'WORKBENCH NOT EXPOSED') : 'MANIFEST UNAVAILABLE'}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                fontWeight: 650,
                backgroundColor: manifestAvailable && view ? surface.sunken : status.brassMuted,
                color: manifestAvailable && view ? ink.secondary : status.brass,
                border: `1px solid ${manifestAvailable && view ? surface.border : status.brass}`
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              size="small"
              variant="outlined"
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              endIcon={<OpenInNewIcon sx={{ fontSize: 10 }} />}
              sx={{
                borderColor: surface.border,
                color: ink.secondary,
                textTransform: 'none',
                fontSize: '0.7rem',
                borderRadius: `${radius.sm}px`,
                '&:hover': { borderColor: surface.borderStrong }
              }}
            >
              Open live Soothsayer
            </Button>
          </Box>
        </Box>

        {/* Workspace Body Split View */}
        <Grid container sx={{ minHeight: 480 }}>
          {/* Mini Left Sidebar: App Context & Features */}
          <Grid
            item
            xs={12}
            md={3.5}
            sx={{
              borderRight: `1px solid ${surface.border}`,
              backgroundColor: surface.sunken,
              p: 2.5,
              display: 'flex',
              flexDirection: 'column',
              gap: 2.5
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.04em' }}>
                Project context
              </Typography>
              <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: surface.raised, borderColor: surface.border }}>
                <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 0.5 }}>
                  Active environment: <strong>{environment || 'production'}</strong>
                </Typography>
                <Typography variant="caption" sx={{ color: ink.secondary, display: 'block', mb: 0.5 }}>
                  Version: <strong>{version || '1.0.0'}</strong>
                </Typography>
                <Typography variant="caption" sx={{ color: ink.secondary, display: 'block' }}>
                  Health: <strong style={{ color: healthStatus === 'available' ? status.neutral : status.brass }}>{healthStatus === 'available' ? 'Available' : 'Not verified'}</strong>
                </Typography>
              </Paper>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.04em' }}>
                Services
              </Typography>
              <Stack spacing={1}>
                {features.map((f: any) => (
                  <Box key={f.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 0.5 }}>
                    <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600 }}>{f.label}</Typography>
                    <Chip
                      label={(f.status || 'unverified').toUpperCase()}
                      size="small"
                      sx={{
                        height: 14,
                        fontSize: '0.5rem',
                        backgroundColor: surface.raised,
                        color: f.status === 'available' ? ink.secondary : ink.muted
                      }}
                    />
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box>
              <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 1, letterSpacing: '0.04em' }}>
                Workflows
              </Typography>
              <Stack spacing={1}>
                {workflows.map((w: any) => (
                  <Box key={w.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FolderIcon sx={{ fontSize: 13, color: accent.violet }} />
                    <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600 }}>{w.label}</Typography>
                  </Box>
                ))}
              </Stack>
            </Box>
            <Box sx={{ mt: 'auto' }}>
              {data.embed?.allowed && data.embedUrl ? (
                <Paper variant="outlined" sx={{ p: 1.5, backgroundColor: surface.raised, borderColor: surface.border }}>
                  <Typography variant="caption" sx={{ color: ink.secondary, fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Live view available
                  </Typography>
                  <Typography variant="caption" sx={{ color: ink.muted, lineHeight: 1.4, display: 'block' }}>
                    Soothsayer permits embedded viewing. The application opens in the canvas.
                  </Typography>
                </Paper>
              ) : (
                <Typography variant="caption" sx={{ color: ink.muted, lineHeight: 1.4, display: 'block' }}>
                  {!data.embedUrl ? 'Live view is not configured.' : 'Embedded viewing is unavailable. Use the live link above.'}
                </Typography>
              )}
            </Box>
          </Grid>

          {/* Middle Workbench Area: Content Draft Preview & Run details */}
          <Grid item xs={12} md={8.5} sx={{ p: 3, display: 'flex', flexDirection: 'column' }}>
            {data.embed?.allowed && data.embedUrl && variant !== 'native-plane' ? (
              <Box sx={{ borderBottom: 1, borderColor: surface.border, mb: 2 }}>
                <Tabs value={activeTab} onChange={(e, val) => setActiveTab(val)} textColor="primary" indicatorColor="primary">
                  <Tab label="Native Workbench" value="native" sx={{ textTransform: 'none', minWidth: 100, fontSize: '0.8rem', fontWeight: 600 }} />
                  <Tab label="Live App" value="live" sx={{ textTransform: 'none', minWidth: 100, fontSize: '0.8rem', fontWeight: 600 }} />
                </Tabs>
              </Box>
            ) : null}

            {activeTab === 'live' && data.embed?.allowed && data.embedUrl && variant !== 'native-plane' ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Safe route selector Chips */}
                {Array.isArray(data.embed.routes) && data.embed.routes.length > 0 && (
                  <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
                    {data.embed.routes.map((route: any) => {
                      const isSelected = activeRouteId === route.id;
                      return (
                        <Chip
                          key={route.id}
                          label={route.label}
                          onClick={() => {
                            setActiveRouteId(route.id);
                            if (route.embedUrl) {
                              setIframeSrc(route.embedUrl);
                            }
                          }}
                          variant={isSelected ? "filled" : "outlined"}
                          size="small"
                          color={isSelected ? "primary" : "default"}
                          sx={{ cursor: 'pointer', fontSize: '0.75rem', height: 24 }}
                        />
                      );
                    })}
                  </Stack>
                )}
                {/* Embed Iframe */}
                <iframe
                  src={iframeSrc || data.embedUrl}
                  title="Live Soothsayer"
                  sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '550px', border: 'none', borderRadius: `${radius.sm}px`, background: surface.sunken }}
                />
              </Box>
            ) : (
              workbench?.views && workbench.views.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 3 }}>
                  <NativeWorkbenchRenderer
                    views={workbench.views}
                    initialValues={data.initialValues}
                  />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, height: '100%' }}>
                  <Paper role="status" variant="outlined" sx={{ p: 3, backgroundColor: status.brassMuted, borderColor: status.brass, borderRadius: `${radius.md}px` }}>
                    <Typography variant="caption" sx={{ color: status.brass, fontWeight: 650, display: 'block', mb: 1 }}>
                      Workbench unavailable
                    </Typography>
                    <Typography variant="body2" sx={{ color: ink.secondary, lineHeight: 1.6 }}>
                      Soothsayer responded without a workbench view. PaneTera will not invent a draft, review gate, evidence state, or run link.
                    </Typography>
                    {workbenchError && (
                      <Typography variant="caption" sx={{ color: ink.muted, display: 'block', mt: 1.5, fontFamily: typography.mono }}>
                        {workbenchError}
                      </Typography>
                    )}
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2.5, backgroundColor: surface.raised, borderColor: surface.border, borderRadius: `${radius.md}px` }}>
                    <Typography variant="caption" sx={{ color: ink.muted, fontWeight: 600, display: 'block', mb: 1.5 }}>
                      Available application details
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {workflows.map((w: any) => (
                        <Chip
                          key={w.id}
                          label={w.label || w.id}
                          size="small"
                          sx={{ backgroundColor: accent.violetMuted, color: accent.violet, border: `1px solid ${accent.violetBorder}` }}
                        />
                      ))}
                      {routes.map((r: any) => (
                        <Chip
                          key={r.path}
                          label={`${r.label || 'GET'} ${r.path}`}
                          size="small"
                          sx={{ backgroundColor: surface.sunken, color: ink.secondary }}
                        />
                      ))}
                    </Stack>
                  </Paper>

                  <Box sx={{ mt: 'auto', display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      size="small"
                      variant="contained"
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ backgroundColor: accent.violet, color: ink.onAccent, textTransform: 'none', fontWeight: 650, borderRadius: `${radius.sm}px`, '&:hover': { backgroundColor: accent.violetHover } }}
                    >
                      Open live Soothsayer
                    </Button>
                  </Box>
                </Box>
              )
            )}
          </Grid>
        </Grid>
      </Paper>
    );
  }
  if (type === 'BrowserObservation') {
    return <BrowserObservationView data={data} variant={variant === 'feed' ? 'feed' : 'main'} />;
  }

  if (type === 'AgentRun' && data) {
    // Live subscription, delta folding, and artifact routing all live inside this
    // component so its hooks sit at a top level, not inside this branch.
    return (
      <AgentRunLiveCard
        data={data}
        token={token}
        onApproveBrowserAction={onApproveBrowserAction}
        onRejectBrowserAction={onRejectBrowserAction}
        onArtifact={onRunArtifact}
      />
    );
  }

  if (type === 'BrowserExtraction') {
    return <BrowserExtractionView data={data} variant={variant === 'feed' ? 'feed' : 'main'} />;
  }

  if (type === 'SchemaCard' && data) {
    return (
      <SchemaCardRenderer
        schemaId={data.schemaId || data.schema?.id || 'generic.status-board'}
        data={data.data || data}
        inlineSchema={data.schema}
        onAction={(actionId: string, payload: Record<string, unknown>) => {
          if (onAction) {
            const proposalId = payload.proposalId || data.data?.proposalId;
            if (actionId === 'approve' && proposalId) {
              onAction(`Approve proposal ${proposalId}`);
            } else if (actionId === 'reject' && proposalId) {
              onAction(`Reject proposal ${proposalId}`);
            } else {
              onAction(`Schema action: ${actionId}${proposalId ? ` for ${proposalId}` : ''}`);
            }
          }
        }}
      />
    );
  }

  return null;
};
