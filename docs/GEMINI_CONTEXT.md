# PaneTera — Gemini 3.6 Context Document

> Canonical project context for executing the four UX enhancement initiatives.

## Project Identity

- **Name:** PaneTera
- **Stack:** Next.js (Pages Router) + React 18 + TypeScript 5 + Tailwind CSS 4 + Vitest
- **Branch:** Work on `dev` branch only. `master` is locked and must not be touched.
- **Purpose:** Single-window governed workbench where users explore projects, inspect live applications, preview proposed work, and approve governed execution.

## Non-Negotiable Architecture Rules

1. **Chat is entry door, not the product.** Main canvas is primary surface.
2. **One dominant surface, one conversation, one next action.**
3. **Drawers must never shrink the canvas.** Use overlay pattern.
4. **Every consequential action requires explicit operator approval.**
5. **All UI must use theme tokens** from `src/theme/cssTokens.ts`. No raw hex codes.
6. **Reduced motion respected.** Use `src/theme/motion.ts` utilities.
7. **Exactly ten intent families.** No eleventh family.
8. **Browser evidence surfaces enforce untrusted content boundaries.** Truncation, redaction, plain text rendering.

## Theme Token Reference

From `src/theme/cssTokens.ts`:

```ts
ink:       { primary: '#1A1A1F', secondary: '#6B6B76', inverse: '#F5F5F5' }
surface:   { card: '#FFFFFF', page: '#F2F2F7', secondary: '#F5F5FA' }
accent:    { primary: '#6C63FF', muted: '#6C63FF20' }
status:    { success: '#4CAF50', warning: '#FFC107', danger: '#E53935' }
attention: { amber: '#C67A00' }
spacing:   { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 }
elevation: { card: '0px 2px 4px rgba(0,0,0,0.08)' }
```

## Design Language

- Warm graphite, violet accent, brass attention, green success only
- No glassmorphism (anti-pattern in this codebase)
- No interactive browsing (agent observes, user acts)
- Canvas width never changes (one dominant surface invariant)

---

## Critical Architectural Risks

### Risk 1: String-Typed Form Model

`SchemaFormView` passes `formValues: Record<string, string>` upward. Adding boolean/number fields breaks this contract.

**Mitigation:** Create `RichSchemaFormView.tsx` as a NEW component alongside the existing one. Do NOT modify the existing `SchemaFormView.tsx`. Widen the type:

```ts
type FormValue = string | number | boolean | string[];
type FormValues = Record<string, FormValue>;
```

### Risk 2: Single-Record Evidence Component

`BrowserEvidenceSurface` accepts exactly one `BrowserEvidenceRecord` and fills its parent.

**Mitigation:** Create `BrowserEvidenceCanvas.tsx` as a NEW wrapper (list + detail). Do NOT refactor the existing `BrowserEvidenceSurface.tsx`.

### Risk 3: "Exactly Ten Families" Constraint

The intent system explicitly declares: "Exactly ten. Composer-local behaviours such as help are expressed as an action within a family, never as an eleventh family."

**Mitigation:** Express markup as an action within the `evidence` family (e.g., `evidence:annotate`). Do NOT add an 11th intent family.

---

## Implementation Plan

### Initiative C: Richer MCP UI & Schema Cards

**Goal:** Improve form validation UX, richer status boards, smarter proposal cards.

#### Step 1: Create RichSchemaFormView.tsx

New file: `src/components/nativeWorkbench/RichSchemaFormView.tsx`

```tsx
// New file - alongside existing SchemaFormView.tsx
// Supports: text, number, boolean (toggle), select, textarea, markdown, code, url, date, file

import React, { useState, useCallback } from 'react';
import { tokens } from '../../theme/cssTokens';

type FormValue = string | number | boolean | string[];

interface RichField {
  name: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'markdown' | 'code' | 'url' | 'date' | 'file';
  required?: boolean;
  validate?: (value: FormValue) => string | null;
  placeholder?: string;
  options?: string[];  // for select type
}

interface RichSchemaFormProps {
  fields: RichField[];
  values: Record<string, FormValue>;
  onChange: (field: string, value: FormValue) => void;
  onSubmit: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export default function RichSchemaFormView({ fields, values, onChange, onSubmit, submitLabel, isSubmitting }: RichSchemaFormProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.required && !values[field.name]) {
        newErrors[field.name] = `${field.label} is required`;
      }
      if (field.validate && values[field.name] !== undefined) {
        const error = field.validate(values[field.name]);
        if (error) newErrors[field.name] = error;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields, values]);

  const handleSubmit = useCallback(() => {
    if (validate()) {
      onSubmit();
    }
  }, [validate, onSubmit]);

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">
      {fields.map(field => (
        <RichFieldRenderer
          key={field.name}
          field={field}
          value={values[field.name]}
          error={errors[field.name]}
          onChange={(val) => onChange(field.name, val)}
        />
      ))}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-6 w-full px-6 py-3 rounded-lg font-medium transition-all duration-200"
        style={{
          backgroundColor: tokens.accent.primary,
          color: tokens.ink.inverse,
        }}
      >
        {isSubmitting ? 'Submitting...' : (submitLabel || 'Submit')}
      </button>
    </form>
  );
}

function RichFieldRenderer({ field, value, error, onChange }: {
  field: RichField;
  value: FormValue;
  error?: string;
  onChange: (value: FormValue) => void;
}) {
  const baseInputStyle = {
    backgroundColor: tokens.surface.card,
    border: `1px solid ${error ? tokens.status.danger : '#E0E0E8'}`,
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '14px',
    outline: 'none',
  };

  switch (field.type) {
    case 'boolean':
      return (
        <div className="flex items-center justify-between mb-4">
          <label className="font-medium text-sm" style={{ color: tokens.ink.primary }}>
            {field.label}
          </label>
          <button
            type="button"
            onClick={() => onChange(!value)}
            className="w-12 h-6 rounded-full transition-colors duration-200"
            style={{
              backgroundColor: value ? tokens.accent.primary : '#E0E0E8',
            }}
          >
            <div
              className="w-5 h-5 rounded-full bg-white shadow-sm transform transition-transform duration-200"
              style={{ transform: `translateX(${value ? '26px' : '2px'})` }}
            />
          </button>
        </div>
      );

    case 'select':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: tokens.ink.primary }}>
            {field.label}
          </label>
          <select
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            className="w-full"
            style={baseInputStyle}
          >
            <option value="">Select...</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {error && (
            <p className="text-xs mt-1" style={{ color: tokens.status.danger }}>{error}</p>
          )}
        </div>
      );

    case 'textarea':
    case 'markdown':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: tokens.ink.primary }}>
            {field.label}
          </label>
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={6}
            className="w-full resize-y"
            style={baseInputStyle}
          />
          {error && (
            <p className="text-xs mt-1" style={{ color: tokens.status.danger }}>{error}</p>
          )}
        </div>
      );

    case 'code':
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: tokens.ink.primary }}>
            {field.label}
          </label>
          <textarea
            value={String(value || '')}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={8}
            className="w-full font-mono text-sm resize-y"
            style={{ ...baseInputStyle, fontFamily: 'ui-monospace, monospace' }}
          />
          {error && (
            <p className="text-xs mt-1" style={{ color: tokens.status.danger }}>{error}</p>
          )}
        </div>
      );

    default:
      return (
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2" style={{ color: tokens.ink.primary }}>
            {field.label}
            {field.required && <span className="ml-1" style={{ color: tokens.status.danger }}>*</span>}
          </label>
          <input
            type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : field.type === 'number' ? 'number' : 'text'}
            value={String(value || '')}
            onChange={(e) => onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)}
            placeholder={field.placeholder}
            className="w-full"
            style={baseInputStyle}
          />
          {error && (
            <p className="text-xs mt-1" style={{ color: tokens.status.danger }}>{error}</p>
          )}
        </div>
      );
  }
}
```

#### Step 2: Update NativeWorkbenchRenderer.tsx

Add view prioritization using existing `status` field (already defined but unused):

```tsx
// In NativeWorkbenchRenderer.tsx - add this helper
function prioritizeViews(views: WorkbenchView[]): WorkbenchView[] {
  const priority: Record<string, number> = {
    'awaiting-review': 1,
    'available': 2,
    'template': 3,
    'no-active-run': 4,
  };
  return [...views].sort((a, b) =>
    (priority[a.status] || 5) - (priority[b.status] || 5)
  );
}

// Update the render logic to use prioritizedViews
const sortedViews = prioritizeViews(views);
// Render first view as primary (full height), rest as secondary
```

#### Step 3: Enhance StatusBoardView.tsx

Add interactive verification checkboxes (self-contained, no prop changes):

```tsx
// Add to StatusBoardView.tsx
const [checks, setChecks] = useState<Record<string, boolean>>({});

const handleCheckToggle = (name: string) => {
  setChecks(prev => ({ ...prev, [name]: !prev[name] }));
};

// In the JSX, render checkboxes for verification items
{verificationItems.map((item) => (
  <div
    key={item.name}
    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
    onClick={() => handleCheckToggle(item.name)}
    style={{ backgroundColor: checks[item.name] ? tokens.accent.muted : 'transparent' }}
  >
    <div
      className="w-5 h-5 rounded flex items-center justify-center"
      style={{
        backgroundColor: checks[item.name] ? tokens.accent.primary : 'transparent',
        border: `2px solid ${checks[item.name] ? tokens.accent.primary : '#E0E0E8'}`,
      }}
    >
      {checks[item.name] && (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
    <span className="text-sm" style={{ color: tokens.ink.primary }}>{item.name}</span>
  </div>
))}
```

#### Step 4: Enhance ProposedActionCard.tsx

Add inline diff viewer and evidence links:

```tsx
// Add new optional props to ProposedActionCard
interface ProposedActionCardProps {
  // ... existing props
  showInlineDiff?: boolean;
  evidenceLinks?: Array<{ id: string; label: string; type: 'screenshot' | 'extraction' | 'observation' }>;
  onEvidenceClick?: (id: string) => void;
}

// Add diff viewer section
{showInlineDiff && action.diff && (
  <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: tokens.surface.secondary }}>
    <h4 className="text-xs font-medium mb-3" style={{ color: tokens.ink.secondary }}>Changes</h4>
    <div className="space-y-1 font-mono text-xs">
      {action.diff.additions.map((line, i) => (
        <div key={`add-${i}`} className="px-2 py-0.5" style={{ backgroundColor: '#4CAF5010', color: tokens.status.success }}>
          + {line}
        </div>
      ))}
      {action.diff.deletions.map((line, i) => (
        <div key={`del-${i}`} className="px-2 py-0.5" style={{ backgroundColor: '#E5393510', color: tokens.status.danger }}>
          - {line}
        </div>
      ))}
    </div>
  </div>
)}

// Add evidence links section
{evidenceLinks && evidenceLinks.length > 0 && (
  <div className="mt-4 flex flex-wrap gap-2">
    {evidenceLinks.map(link => (
      <button
        key={link.id}
        onClick={() => onEvidenceClick?.(link.id)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
        style={{
          backgroundColor: tokens.surface.secondary,
          color: tokens.ink.secondary,
          border: '1px solid #E0E0E8',
        }}
      >
        {link.type === 'screenshot' && '📸'}
        {link.type === 'extraction' && '🔍'}
        {link.type === 'observation' && '👁️'}
        {link.label}
      </button>
    ))}
  </div>
)}
```

---

### Initiative D: Browser Evidence Split-Pane

**Goal:** Multi-record evidence canvas with split-pane layout.

#### Step 1: Add Batch Retrieval to Server

Update `server/browserEvidenceStore.ts`:

```ts
// Add new method to BrowserEvidenceStore class
getRecentExtractions(limit: number = 10): BrowserEvidenceRecord[] {
  return this.records
    .slice(-limit)
    .reverse();
}

// Update the API route to support list retrieval
// In the server handler for /api/browser-evidence
if (req.method === 'GET' && req.query.action === 'list') {
  const limit = parseInt(req.query.limit as string) || 10;
  const records = evidenceStore.getRecentExtractions(limit);
  return res.json({ records });
}
```

#### Step 2: Create BrowserEvidenceCanvas.tsx

New file: `src/components/workbench/BrowserEvidenceCanvas.tsx`

```tsx
// New wrapper component - list + detail split-pane
import React, { useState, useCallback, useMemo } from 'react';
import { tokens } from '../../theme/cssTokens';
import BrowserEvidenceSurface from './BrowserEvidenceSurface';
import { BrowserEvidenceRecord } from './browserEvidenceViewModel';

interface BrowserEvidenceCanvasProps {
  records: BrowserEvidenceRecord[];
  onReturnToPreview: () => void;
}

export default function BrowserEvidenceCanvas({ records, onReturnToPreview }: BrowserEvidenceCanvasProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    records.length > 0 ? records[records.length - 1].captureId : null
  );
  const [selectedIndex, setSelectedIndex] = useState<number>(
    records.length > 0 ? records.length - 1 : 0
  );

  const selectedRecord = useMemo(() =>
    records.find(r => r.captureId === selectedId) || records[records.length - 1],
    [records, selectedId]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(0, prev - 1));
      setSelectedId(records[Math.max(0, selectedIndex - 1)]?.captureId || null);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(records.length - 1, prev + 1));
      setSelectedId(records[Math.min(records.length - 1, selectedIndex + 1)]?.captureId || null);
    } else if (e.key === 'Enter' && selectedRecord) {
      // Could trigger a deep action
    }
  }, [records, selectedIndex, selectedRecord]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'screenshot': return '📸';
      case 'text': return '📝';
      case 'structured-data': return '📊';
      case 'links': return '🔗';
      case 'images': return '🖼️';
      default: return '📄';
    }
  };

  return (
    <div className="flex h-full" style={{ backgroundColor: tokens.surface.page }}>
      {/* Left Panel: Extraction List */}
      <div
        className="w-[300px] flex-shrink-0 border-r overflow-y-auto"
        style={{ borderColor: '#E0E0E8' }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold" style={{ color: tokens.ink.primary }}>
              Evidence History
            </h3>
            <span className="text-xs" style={{ color: tokens.ink.secondary }}>
              {records.length} capture{records.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="space-y-2">
            {records.map((record, index) => (
              <button
                key={record.captureId}
                onClick={() => {
                  setSelectedId(record.captureId);
                  setSelectedIndex(index);
                }}
                className="w-full text-left p-3 rounded-lg transition-all"
                style={{
                  backgroundColor: selectedId === record.captureId
                    ? tokens.accent.muted
                    : tokens.surface.card,
                  border: `1px solid ${selectedId === record.captureId
                    ? tokens.accent.primary
                    : '#E0E0E8'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getIconForType(record.data.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: tokens.ink.primary }}>
                      {record.metadata.url ? new URL(record.metadata.url).hostname : 'Extraction'}
                    </div>
                    <div className="text-xs truncate" style={{ color: tokens.ink.secondary }}>
                      {record.metadata.title || record.data.type}
                    </div>
                  </div>
                </div>
                <div className="mt-2 text-xs" style={{ color: tokens.ink.secondary }}>
                  {new Date(record.metadata.timestamp).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Detail View */}
      <div className="flex-1 overflow-hidden">
        {selectedRecord ? (
          <BrowserEvidenceSurface
            captureId={selectedRecord.captureId}
            onClose={onReturnToPreview}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p style={{ color: tokens.ink.secondary }}>Select an extraction to view</p>
          </div>
        )}
      </div>
    </div>
  );
}
```

#### Step 3: Create ExtractionCard.tsx

New file: `src/components/workbench/ExtractionCard.tsx`

```tsx
// Single component with type-specific rendering
import React from 'react';
import { tokens } from '../../theme/cssTokens';
import { BrowserExtraction } from './browserEvidenceViewModel';

interface ExtractionCardProps {
  data: BrowserExtraction;
}

export default function ExtractionCard({ data }: ExtractionCardProps) {
  switch (data.type) {
    case 'screenshot':
      return <ScreenshotCard data={data} />;
    case 'text':
      return <TextCard data={data} />;
    case 'structured-data':
      return <StructuredDataCard data={data} />;
    case 'links':
      return <LinksCard data={data} />;
    case 'images':
      return <ImagesCard data={data} />;
    default:
      return <FallbackCard data={data} />;
  }
}

function ScreenshotCard({ data }: { data: BrowserExtraction }) {
  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: tokens.surface.card }}>
      <h4 className="text-sm font-medium mb-3" style={{ color: tokens.ink.primary }}>Screenshot</h4>
      {data.imageUrl ? (
        <img
          src={data.imageUrl}
          alt="Browser screenshot"
          className="w-full rounded-lg border"
          style={{ borderColor: '#E0E0E8' }}
        />
      ) : (
        <div className="text-sm" style={{ color: tokens.ink.secondary }}>No image available</div>
      )}
    </div>
  );
}

function TextCard({ data }: { data: BrowserExtraction }) {
  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: tokens.surface.card }}>
      <h4 className="text-sm font-medium mb-3" style={{ color: tokens.ink.primary }}>Extracted Text</h4>
      <div className="text-sm whitespace-pre-wrap" style={{ color: tokens.ink.primary }}>
        {data.textContent || 'No text extracted'}
      </div>
    </div>
  );
}

function StructuredDataCard({ data }: { data: BrowserExtraction }) {
  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: tokens.surface.card }}>
      <h4 className="text-sm font-medium mb-3" style={{ color: tokens.ink.primary }}>Structured Data</h4>
      <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{
        backgroundColor: tokens.surface.secondary,
        color: tokens.ink.primary,
      }}>
        {JSON.stringify(data.structuredData, null, 2)}
      </pre>
    </div>
  );
}

function LinksCard({ data }: { data: BrowserExtraction }) {
  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: tokens.surface.card }}>
      <h4 className="text-sm font-medium mb-3" style={{ color: tokens.ink.primary }}>Links</h4>
      <ul className="space-y-2">
        {(data.links || []).map((link, i) => (
          <li key={i} className="text-sm">
            <span style={{ color: tokens.accent.primary }}>{link.text}</span>
            <span className="ml-2" style={{ color: tokens.ink.secondary }}>{link.url}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImagesCard({ data }: { data: BrowserExtraction }) {
  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: tokens.surface.card }}>
      <h4 className="text-sm font-medium mb-3" style={{ color: tokens.ink.primary }}>Images</h4>
      <div className="grid grid-cols-2 gap-3">
        {(data.images || []).map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`Extracted image ${i + 1}`}
            className="w-full rounded-lg border"
            style={{ borderColor: '#E0E0E8' }}
          />
        ))}
      </div>
    </div>
  );
}

function FallbackCard({ data }: { data: BrowserExtraction }) {
  return (
    <div className="p-4 rounded-lg" style={{ backgroundColor: tokens.surface.card }}>
      <h4 className="text-sm font-medium mb-3" style={{ color: tokens.ink.primary }}>Extraction</h4>
      <pre className="text-xs p-3 rounded-lg overflow-x-auto" style={{
        backgroundColor: tokens.surface.secondary,
        color: tokens.ink.primary,
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
```

#### Step 4: Update BrowserLiveSurface.tsx

Add "Live view" / "Evidence history" tab switching:

```tsx
// Add state for active tab
const [activeTab, setActiveTab] = useState<'live' | 'evidence'>('live');
const [evidenceRecords, setEvidenceRecords] = useState<BrowserEvidenceRecord[]>([]);

// Fetch evidence records when tab changes
useEffect(() => {
  if (activeTab === 'evidence') {
    fetch('/api/browser-evidence?action=list&limit=10')
      .then(res => res.json())
      .then(data => setEvidenceRecords(data.records || []));
  }
}, [activeTab]);

// Add tab bar at the top
<div className="flex items-center gap-4 mb-4">
  <button
    onClick={() => setActiveTab('live')}
    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
    style={{
      backgroundColor: activeTab === 'live' ? tokens.accent.primary : 'transparent',
      color: activeTab === 'live' ? tokens.ink.inverse : tokens.ink.secondary,
    }}
  >
    Live View
  </button>
  <button
    onClick={() => setActiveTab('evidence')}
    className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
    style={{
      backgroundColor: activeTab === 'evidence' ? tokens.accent.primary : 'transparent',
      color: activeTab === 'evidence' ? tokens.ink.inverse : tokens.ink.secondary,
    }}
  >
    Evidence History ({evidenceRecords.length})
  </button>
</div>

// Conditionally render based on active tab
{activeTab === 'live' ? (
  <BrowserLiveSurface onReturnToPreview={onReturnToPreview} />
) : (
  <BrowserEvidenceCanvas
    records={evidenceRecords}
    onReturnToPreview={onReturnToPreview}
  />
)}
```

---

### Initiative B: Interactive Markup Pen

**Goal:** Canvas selection → contextual action, file tree annotations.

#### Step 1: Create CanvasSelectionProvider.tsx

New file: `src/components/workstation/CanvasSelectionProvider.tsx`

```tsx
// React context for canvas text selection
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface CanvasSelectionState {
  text: string;
  sourceElement: string;  // CSS selector or DOM path
  rect: DOMRect;
  sourceFile?: string;
  sourceLine?: number;
  timestamp: number;
}

interface CanvasSelectionContextType {
  selection: CanvasSelectionState | null;
  setSelection: (selection: CanvasSelectionState | null) => void;
  clearSelection: () => void;
}

const CanvasSelectionContext = createContext<CanvasSelectionContextType | null>(null);

export function CanvasSelectionProvider({ children }: { children: ReactNode }) {
  const [selection, setSelectionState] = useState<CanvasSelectionState | null>(null);

  const setSelection = useCallback((sel: CanvasSelectionState | null) => {
    setSelectionState(sel ? { ...sel, timestamp: Date.now() } : null);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectionState(null);
  }, []);

  return (
    <CanvasSelectionContext.Provider value={{ selection, setSelection, clearSelection }}>
      {children}
    </CanvasSelectionContext.Provider>
  );
}

export function useCanvasSelection() {
  const context = useContext(CanvasSelectionContext);
  if (!context) {
    throw new Error('useCanvasSelection must be used within CanvasSelectionProvider');
  }
  return context;
}
```

#### Step 2: Create MarkupToolbar.tsx

New file: `src/components/workstation/MarkupToolbar.tsx`

```tsx
// Floating toolbar that appears on canvas selection
import React, { useState, useEffect, useRef } from 'react';
import { tokens } from '../../theme/cssTokens';
import { useCanvasSelection } from './CanvasSelectionProvider';

interface MarkupToolbarProps {
  onAnnotate: (text: string, annotation: string) => void;
  onExplain: (text: string) => void;
  onSearch: (text: string) => void;
}

export default function MarkupToolbar({ onAnnotate, onExplain, onSearch }: MarkupToolbarProps) {
  const { selection, clearSelection } = useCanvasSelection();
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selection) {
      // Position toolbar below selection
      setPosition({
        x: selection.rect.left + selection.rect.width / 2,
        y: selection.rect.bottom + 8,
      });
    } else {
      setPosition(null);
    }
  }, [selection]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        clearSelection();
        setShowAnnotationInput(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [clearSelection]);

  if (!selection || !position) return null;

  return (
    <div
      ref={toolbarRef}
      className="fixed z-50 animate-fadeIn"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <div
        className="rounded-xl shadow-lg p-2 flex items-center gap-1"
        style={{
          backgroundColor: tokens.surface.card,
          border: '1px solid #E0E0E8',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}
      >
        <button
          onClick={() => onExplain(selection.text)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ backgroundColor: tokens.accent.muted, color: tokens.accent.primary }}
        >
          Explain
        </button>
        <button
          onClick={() => onSearch(selection.text)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ backgroundColor: tokens.surface.secondary, color: tokens.ink.secondary }}
        >
          Search
        </button>
        <button
          onClick={() => setShowAnnotationInput(!showAnnotationInput)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
          style={{ backgroundColor: tokens.surface.secondary, color: tokens.ink.secondary }}
        >
          Annotate
        </button>
      </div>

      {showAnnotationInput && (
        <div
          className="mt-2 rounded-xl shadow-lg p-3"
          style={{
            backgroundColor: tokens.surface.card,
            border: '1px solid #E0E0E8',
          }}
        >
          <textarea
            value={annotationText}
            onChange={(e) => setAnnotationText(e.target.value)}
            placeholder="Add your annotation..."
            className="w-full text-sm p-2 rounded-lg resize-none"
            rows={3}
            style={{
              backgroundColor: tokens.surface.secondary,
              border: '1px solid #E0E0E8',
              outline: 'none',
            }}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={() => {
                setShowAnnotationInput(false);
                setAnnotationText('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ color: tokens.ink.secondary }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onAnnotate(selection.text, annotationText);
                clearSelection();
                setShowAnnotationInput(false);
                setAnnotationText('');
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium"
              style={{ backgroundColor: tokens.accent.primary, color: tokens.ink.inverse }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

#### Step 3: Integrate in WorkstationShell.tsx

Add selection listener and floating toolbar:

```tsx
// Add imports
import { CanvasSelectionProvider, useCanvasSelection } from './CanvasSelectionProvider';
import MarkupToolbar from './MarkupToolbar';

// Wrap canvas with provider
<CanvasSelectionProvider>
  <div className="flex-1 overflow-auto relative" style={{ backgroundColor: tokens.surface.page }}>
    <WorkstationCanvas
      className="flex-1 p-4"
      onCanvasClick={handleCanvasClick}
    />
    <MarkupToolbar
      onAnnotate={(text, annotation) => {
        // Dispatch to composer as evidence:annotate action
        console.log('Annotate:', text, annotation);
      }}
      onExplain={(text) => {
        // Open composer with explanation request
        console.log('Explain:', text);
      }}
      onSearch={(text) => {
        // Open composer with search request
        console.log('Search:', text);
      }}
    />
  </div>
</CanvasSelectionProvider>

// Add selection listener to canvas
useEffect(() => {
  const handleSelectionChange = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const sourceElement = selection.anchorNode?.parentElement?.tagName || 'unknown';

      setSelection({
        text: selection.toString().trim(),
        sourceElement,
        rect,
        sourceFile: undefined,  // Could be detected from context
        sourceLine: undefined,
      });
    }
  };

  document.addEventListener('selectionchange', handleSelectionChange);
  return () => document.removeEventListener('selectionchange', handleSelectionChange);
}, [setSelection]);
```

#### Step 4: Extend FilePreviewPanel.tsx

Add line-range selection:

```tsx
// Add state for line selection
const [selectedLines, setSelectedLines] = useState<{ start: number; end: number } | null>(null);
const [selectionStart, setSelectionStart] = useState<number | null>(null);

// Add click handlers to line numbers
const handleLineNumberClick = (lineNumber: number) => {
  if (selectionStart === null) {
    // Start selection
    setSelectionStart(lineNumber);
    setSelectedLines(null);
  } else {
    // End selection
    const start = Math.min(selectionStart, lineNumber);
    const end = Math.max(selectionStart, lineNumber);
    setSelectedLines({ start, end });
    setSelectionStart(null);

    // Dispatch selection to context
    setSelection({
      text: lines.slice(start - 1, end).join('\n'),
      sourceElement: 'FilePreviewPanel',
      rect: document.querySelector(`[data-line="${start}"]`)?.getBoundingClientRect() || new DOMRect(),
      sourceFile: filePath,
      sourceLine: start,
    });
  }
};

// In JSX, add data-line attribute and click handler
{lines.map((line, index) => (
  <div
    key={index}
    data-line={index + 1}
    className="flex"
    style={{
      backgroundColor: selectedLines &&
        index + 1 >= selectedLines.start &&
        index + 1 <= selectedLines.end
          ? tokens.accent.muted
          : 'transparent',
    }}
  >
    <button
      onClick={() => handleLineNumberClick(index + 1)}
      className="w-12 text-right pr-3 select-none cursor-pointer"
      style={{
        color: selectionStart === index + 1 ? tokens.accent.primary : tokens.ink.secondary,
        fontWeight: selectionStart === index + 1 ? 'bold' : 'normal',
      }}
    >
      {index + 1}
    </button>
    <pre className="flex-1 px-4 py-0.5">{line}</pre>
  </div>
))}
```

#### Step 5: Add Annotations to Headroom Capsule

Update `server/headroom/capsuleSchema.ts`:

```ts
// Add new array field following existing stringList() pattern
annotations: stringList({
  maxItems: 100,
  maxCharPerItem: 2000,
  description: "Annotations and markup notes for the capsule",
}),

// Add interface to HeadroomCapsule
interface HeadroomCapsule {
  // ... existing fields
  annotations: string[];
}
```

---

### Initiative A: Canvas Start Polish

**Goal:** Better empty, loading, error, and success states.

#### Step 1: Create State Components

New files in `src/components/workstation/`:

```tsx
// EmptyState.tsx
export default function EmptyState({ title, description, icon, action }: {
  title: string;
  description: string;
  icon?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      {icon && <div className="text-4xl mb-4">{icon}</div>}
      <h3 className="text-lg font-semibold mb-2" style={{ color: tokens.ink.primary }}>{title}</h3>
      <p className="text-sm text-center max-w-md" style={{ color: tokens.ink.secondary }}>{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 px-6 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ backgroundColor: tokens.accent.primary, color: tokens.ink.inverse }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

// LoadingState.tsx
export default function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{
        borderColor: tokens.accent.muted,
        borderTopColor: tokens.accent.primary,
      }} />
      {message && (
        <p className="mt-4 text-sm" style={{ color: tokens.ink.secondary }}>{message}</p>
      )}
    </div>
  );
}

// ErrorState.tsx
export default function ErrorState({ title, message, retry }: {
  title: string;
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-4xl mb-4">⚠️</div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: tokens.status.danger }}>{title}</h3>
      <p className="text-sm text-center max-w-md" style={{ color: tokens.ink.secondary }}>{message}</p>
      {retry && (
        <button
          onClick={retry}
          className="mt-6 px-6 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ backgroundColor: tokens.status.danger, color: tokens.ink.inverse }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// SuccessState.tsx
export default function SuccessState({ title, message, action }: {
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-4xl mb-4">✓</div>
      <h3 className="text-lg font-semibold mb-2" style={{ color: tokens.status.success }}>{title}</h3>
      <p className="text-sm text-center max-w-md" style={{ color: tokens.ink.secondary }}>{message}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 px-6 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ backgroundColor: tokens.status.success, color: tokens.ink.inverse }}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

#### Step 2: Migrate FilePreviewPanel to Theme Tokens

Replace hardcoded hex colors with tokens:

```tsx
// FilePreviewPanel.tsx - replace hardcoded colors
// Before:
style={{ backgroundColor: '#FFFFFF', color: '#1A1A1F' }}
style={{ backgroundColor: '#F2F2F7', color: '#6B6B76' }}
style={{ color: '#6C63FF' }}
style={{ backgroundColor: '#E0E0E8' }}

// After:
style={{ backgroundColor: tokens.surface.card, color: tokens.ink.primary }}
style={{ backgroundColor: tokens.surface.page, color: tokens.ink.secondary }}
style={{ color: tokens.accent.primary }}
style={{ backgroundColor: tokens.surface.secondary }}
```

---

## Verification Commands

After each phase, run:

```bash
npm run lint
npm run build
npm test
```

All 80 test files must pass. No regressions allowed.

---

## File Locations Reference

| Component | Location | Notes |
|-----------|----------|-------|
| SchemaFormView | `src/components/nativeWorkbench/SchemaFormView.tsx` | Do NOT modify |
| RichSchemaFormView | `src/components/nativeWorkbench/RichSchemaFormView.tsx` | NEW |
| NativeWorkbenchRenderer | `src/components/nativeWorkbench/NativeWorkbenchRenderer.tsx` | Update routing |
| StatusBoardView | `src/components/nativeWorkbench/StatusBoardView.tsx` | Add interactivity |
| ProposedActionCard | `src/components/ProposedActionCard.tsx` | Add diff & evidence |
| BrowserEvidenceSurface | `src/components/workbench/BrowserEvidenceSurface.tsx` | Do NOT modify |
| BrowserEvidenceCanvas | `src/components/workbench/BrowserEvidenceCanvas.tsx` | NEW wrapper |
| ExtractionCard | `src/components/workbench/ExtractionCard.tsx` | NEW |
| BrowserLiveSurface | `src/components/workbench/BrowserLiveSurface.tsx` | Add tab switching |
| BrowserEvidenceStore | `server/browserEvidenceStore.ts` | Add batch retrieval |
| CanvasSelectionProvider | `src/components/workstation/CanvasSelectionProvider.tsx` | NEW context |
| MarkupToolbar | `src/components/workstation/MarkupToolbar.tsx` | NEW floating toolbar |
| WorkstationShell | `src/components/workstation/WorkstationShell.tsx` | Integrate selection |
| FilePreviewPanel | `src/components/workstation/FilePreviewPanel.tsx` | Add line selection |
| Headroom Capsule Schema | `server/headroom/capsuleSchema.ts` | Add annotations field |
| EmptyState | `src/components/workstation/EmptyState.tsx` | NEW |
| LoadingState | `src/components/workstation/LoadingState.tsx` | NEW |
| ErrorState | `src/components/workstation/ErrorState.tsx` | NEW |
| SuccessState | `src/components/workstation/SuccessState.tsx` | NEW |
| Theme Tokens | `src/theme/cssTokens.ts` | Reference only |
| Motion Utilities | `src/theme/motion.ts` | Reference only |
| Intent Resolver | `src/composer/intentResolver.ts` | Do NOT add 11th family |
