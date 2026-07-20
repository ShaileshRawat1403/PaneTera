// src/composer/pickerCoordinator.ts
// Promise bookkeeping for the attachment picker.
//
// Extracted from App so replacement, cancellation, unmount and stale-result
// behaviour can be executed in a test rather than asserted by reading the
// source. A regex proving `settlePicker(null)` appears somewhere does not prove
// a pending promise ever settles.
//
// The invariant: every promise this hands out settles exactly once. A composer
// left awaiting forever stops responding to the `+` menu with no visible cause.

export type PickerResolve<T> = (value: T | null) => void;

export class PickerCoordinator<T> {
  private pending: PickerResolve<T> | null = null;

  /**
   * Begin a request.
   *
   * A second request supersedes the first, which settles as null. Without that,
   * clicking "Choose file" and then "Choose folder" would strand the first
   * promise forever.
   */
  request(): Promise<T | null> {
    this.settle(null);
    return new Promise<T | null>((resolve) => {
      this.pending = resolve;
    });
  }

  /** Settle the outstanding request, if any. Safe to call repeatedly. */
  settle(value: T | null): void {
    const resolve = this.pending;
    this.pending = null;
    resolve?.(value);
  }

  /** Whether a request is still awaiting a result. Test and assertion support. */
  get isPending(): boolean {
    return this.pending !== null;
  }

  /** Settle everything outstanding. Called on unmount. */
  dispose(): void {
    this.settle(null);
  }
}

/**
 * Guard for asynchronous results that may arrive out of order.
 *
 * A listing requested for project A can land after the user has moved to
 * project B. Comparing against the token taken when the request began means the
 * late result is discarded rather than shown under the wrong project.
 */
export class LatestOnly {
  private token = 0;

  begin(): number {
    this.token += 1;
    return this.token;
  }

  isCurrent(token: number): boolean {
    return token === this.token;
  }

  /** Invalidate everything in flight without starting a new request. */
  cancel(): void {
    this.token += 1;
  }
}
