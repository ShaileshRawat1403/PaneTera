import { v4 as uuidv4 } from 'uuid';

export interface Lease {
  leaseId: string;
  resourceType: 'captureId' | 'extractionId' | 'evidenceId';
  resourceId: string;
  expiresAt: number;
}

export class EvidenceRetentionService {
  private leases: Map<string, Lease> = new Map();
  private readonly DEFAULT_LEASE_MS = 5 * 60 * 1000; // 5 minutes defensive expiry

  public acquireLease(resourceType: 'captureId' | 'extractionId' | 'evidenceId', resourceId: string): string {
    const leaseId = uuidv4();
    this.leases.set(leaseId, {
      leaseId,
      resourceType,
      resourceId,
      expiresAt: Date.now() + this.DEFAULT_LEASE_MS
    });
    return leaseId;
  }

  public releaseLease(leaseId: string): void {
    this.leases.delete(leaseId);
  }

  public isLeased(resourceType: 'captureId' | 'extractionId' | 'evidenceId', resourceId: string): boolean {
    const now = Date.now();
    for (const [leaseId, lease] of this.leases.entries()) {
      if (lease.expiresAt < now) {
        // Automatically prune expired leases during inspection
        this.leases.delete(leaseId);
        continue;
      }
      if (lease.resourceType === resourceType && lease.resourceId === resourceId) {
        return true;
      }
    }
    return false;
  }

  public async withEvidenceLeases<T>(
    resourceRefs: Array<{ type: 'captureId' | 'extractionId' | 'evidenceId', id: string }>,
    operation: () => Promise<T>
  ): Promise<T> {
    const acquiredLeaseIds: string[] = [];
    try {
      for (const ref of resourceRefs) {
        acquiredLeaseIds.push(this.acquireLease(ref.type, ref.id));
      }
      return await operation();
    } finally {
      for (const leaseId of acquiredLeaseIds) {
        this.releaseLease(leaseId);
      }
    }
  }
}

export const evidenceRetentionService = new EvidenceRetentionService();

export function setEvidenceRetentionServiceForTest(service: EvidenceRetentionService | undefined) {
  Object.assign(evidenceRetentionService, service || new EvidenceRetentionService());
  if (service === undefined) {
    // Reset internal state if undefined
    (evidenceRetentionService as any).leases = new Map();
  }
}
