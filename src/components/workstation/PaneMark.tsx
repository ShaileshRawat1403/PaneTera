// src/components/workstation/PaneMark.tsx
//
// The PaneTera mark: a divided pane with one quadrant lit, the pane-seam motif
// that reads across the product — several contexts converging into one governed
// workspace. It is decorative; the "PaneTera" wordmark beside it is the accessible
// name, so the mark is hidden from assistive technology. Token-driven, so it warms
// and re-themes with everything else.

import React from 'react';
import { accent, ink } from '../../theme/tokens';

export function PaneMark({ size = 18 }: { size?: number }): React.ReactElement {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden focusable="false" role="presentation">
      <rect x="2" y="2" width="16" height="16" rx="3.5" stroke={ink.secondary} strokeWidth="1.3" opacity="0.55" />
      <line x1="10" y1="3" x2="10" y2="17" stroke={ink.secondary} strokeWidth="1.1" opacity="0.4" />
      <line x1="3" y1="10" x2="17" y2="10" stroke={ink.secondary} strokeWidth="1.1" opacity="0.4" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" fill={accent.violet} />
    </svg>
  );
}
