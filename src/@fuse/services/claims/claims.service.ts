import { Injectable } from '@angular/core';

export interface BOClaimPermissions {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

export interface BODomainClaimsEntry {
    domain: string;
    claims: Record<string, BOClaimPermissions>;
}

/**
 * Service that stores and resolves backoffice user permissions (claims).
 *
 * Claims are loaded once at login and persisted in localStorage under `bo_claims`.
 *
 * Domain lookup is case-insensitive so that nav items declared as 'USERS' will
 * correctly match a DB domain whose Code is 'users' (or vice-versa).
 *
 * Permissions are aggregated across ALL claims within the matched domain using
 * OR logic — if any claim grants canView/canEdit/canDelete, the answer is true.
 * This works whether the domain has a single "access" claim or many fine-grained ones.
 *
 * Usage in components:
 *   claimsService = inject(ClaimsService);
 *   [disabled]="!claimsService.canEdit('USERS')"
 */
@Injectable({ providedIn: 'root' })
export class ClaimsService {

    private readonly STORAGE_KEY = 'bo_claims';

    // ─── Storage ──────────────────────────────────────────────────────────────

    setClaims(claims: BODomainClaimsEntry[]): void {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(claims));
    }

    clearClaims(): void {
        localStorage.removeItem(this.STORAGE_KEY);
    }

    getClaims(): BODomainClaimsEntry[] {
        const raw = localStorage.getItem(this.STORAGE_KEY);
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw) as BODomainClaimsEntry[];
            // Safety net: if every single claim across all domains has canView=false
            // (role configured but no permissions set up yet), stay permissive.
            if (parsed.length > 0) {
                const hasAnyView = parsed.some(d =>
                    Object.values(d.claims ?? {}).some(p => p.canView)
                );
                if (!hasAnyView) return [];
            }
            return parsed;
        } catch { return []; }
    }

    // ─── Permission helpers ───────────────────────────────────────────────────

    /**
     * Finds the domain entry whose code matches (case-insensitive).
     * When multiple entries match (e.g. old "users" + new "USERS"), the one that
     * grants the most access wins — we pick the FIRST that has canView=true, or
     * the very first match otherwise.
     */
    private findEntry(domain: string): BODomainClaimsEntry | null {
        const claims = this.getClaims();
        if (!claims.length) return null;

        const key = domain.toLowerCase();
        const matches = claims.filter(d => d.domain.toLowerCase() === key);
        if (!matches.length) return null;

        // Prefer the entry that actually grants canView (i.e. the configured one)
        return matches.find(m => Object.values(m.claims ?? {}).some(p => p.canView))
            ?? matches[0];
    }

    /**
     * Aggregates a permission flag across all claims in the entry using OR logic.
     * Returns true if any single claim within the domain grants the permission.
     */
    private aggregate(entry: BODomainClaimsEntry, flag: keyof BOClaimPermissions): boolean {
        return Object.values(entry.claims ?? {}).some(p => p[flag]);
    }

    // ─── Public API ───────────────────────────────────────────────────────────

    /**
     * True when the user can VIEW the domain.
     * Permissive (true) when no claims are stored at all.
     * Permissive (true) when the domain is not found in claims.
     */
    canView(domain: string): boolean {
        const claims = this.getClaims();
        if (!claims.length) return true;
        const entry = this.findEntry(domain);
        if (!entry) return true;           // domain not configured → show by default
        return this.aggregate(entry, 'canView');
    }

    /** True when the user can CREATE / EDIT in the domain. */
    canEdit(domain: string): boolean {
        const claims = this.getClaims();
        if (!claims.length) return true;
        const entry = this.findEntry(domain);
        if (!entry) return true;
        return this.aggregate(entry, 'canEdit');
    }

    /** True when the user can DELETE in the domain. */
    canDelete(domain: string): boolean {
        const claims = this.getClaims();
        if (!claims.length) return true;
        const entry = this.findEntry(domain);
        if (!entry) return true;
        return this.aggregate(entry, 'canDelete');
    }
}
