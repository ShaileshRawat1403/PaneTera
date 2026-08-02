// src/hooks/useSmoothStream.ts
//
// Buttery per-token reveal for streamed replies.
//
// The server already pushes each token fragment the instant it arrives, over the
// run's SSE (see server/agent/routes.ts). But fragments do not arrive one clean
// token at a time: the network and the dev proxy buffer, and the model emits
// several tokens per chunk, so a burst of characters lands in a single SSE frame.
// Painting that straight to the DOM makes the reply jump in visible chunks.
//
// This decouples paint cadence from arrival cadence. Arrived text is treated as a
// target; we reveal it a little each animation frame so it flows out smoothly no
// matter how it landed. The step scales with the backlog, so the reveal speeds up
// when the stream is ahead and settles to a calm cadence when it has caught up,
// which keeps the visible text from ever lagging far behind the real stream.

import { useEffect, useRef, useState } from 'react';

export interface RevealOptions {
  /** Larger divisor = gentler catch-up (fewer chars per frame for a given backlog). */
  divisor?: number;
  /** Never reveal fewer than this many chars per frame while behind, so progress never stalls. */
  min?: number;
  /** Never reveal more than this many chars per frame, so even a large backlog still visibly streams. */
  max?: number;
}

// Pure stepping function: given how many characters are currently shown and the
// length of the arrived target, return the next shown count for one frame. Pure
// and framework free, so it is unit-tested without a DOM or a clock.
export function revealStep(shown: number, targetLength: number, opts: RevealOptions = {}): number {
  const { divisor = 6, min = 1, max = 48 } = opts;
  const remaining = targetLength - shown;
  if (remaining <= 0) return Math.min(shown, targetLength);
  const step = Math.min(max, Math.max(min, Math.ceil(remaining / divisor)));
  return Math.min(targetLength, shown + step);
}

// Reveals `target` one animation frame at a time. While `done` is false the text
// drains smoothly toward whatever has arrived; when `done` flips true the rest is
// revealed at once, so a completed reply never lags. Event mode passes an empty
// target (no deltas) and is therefore unaffected: nothing to smooth, the final
// reply lands whole exactly as before.
//
// The loop only reschedules while it is catching up. Once it reaches the current
// target it stops and waits for the next change (target growth or `done`), which
// the effect dependencies pick up. This avoids an idle 60fps spin during pauses,
// and keeps the loop finite under a synchronous requestAnimationFrame stub (the
// test DOM), where an always-rescheduling loop would recurse forever.
export function useSmoothStream(target: string, done: boolean, opts?: RevealOptions): string {
  const [shown, setShown] = useState(0);
  const targetRef = useRef(target);
  const doneRef = useRef(done);
  const shownRef = useRef(0);
  const optsRef = useRef(opts);
  targetRef.current = target;
  doneRef.current = done;
  optsRef.current = opts;

  useEffect(() => {
    let raf = 0;
    const tick = (): void => {
      const t = targetRef.current;
      // Target replaced by a shorter string (deltas gave way to a shorter final
      // reply): clamp so we never slice past its end.
      if (shownRef.current > t.length) {
        shownRef.current = t.length;
        setShown(t.length);
      }
      if (doneRef.current) {
        if (shownRef.current !== t.length) {
          shownRef.current = t.length;
          setShown(t.length);
        }
        return; // terminal reply reached: reveal in full and stop
      }
      if (shownRef.current < t.length) {
        const next = revealStep(shownRef.current, t.length, optsRef.current);
        shownRef.current = next;
        setShown(next);
        raf = requestAnimationFrame(tick); // reschedule only while catching up
        return;
      }
      // Caught up and still streaming: stop and wait for the next arrival, which
      // re-runs this effect via its dependencies.
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, done]);

  return target.slice(0, Math.min(shown, target.length));
}
