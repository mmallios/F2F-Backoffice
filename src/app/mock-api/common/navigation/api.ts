import { Injectable } from '@angular/core';
import { FuseNavigationItem } from '@fuse/components/navigation';
import { FuseMockApiService } from '@fuse/lib/mock-api';
import { ClaimsService } from '@fuse/services/claims/claims.service';
import {
    compactNavigation,
    defaultNavigation,
    futuristicNavigation,
    horizontalNavigation,
} from 'app/mock-api/common/navigation/data';
import { cloneDeep } from 'lodash-es';

@Injectable({ providedIn: 'root' })
export class NavigationMockApi {
    private readonly _compactNavigation: FuseNavigationItem[] =
        compactNavigation;
    private readonly _defaultNavigation: FuseNavigationItem[] =
        defaultNavigation;
    private readonly _futuristicNavigation: FuseNavigationItem[] =
        futuristicNavigation;
    private readonly _horizontalNavigation: FuseNavigationItem[] =
        horizontalNavigation;

    constructor(
        private _fuseMockApiService: FuseMockApiService,
        private _claimsService: ClaimsService,
    ) {
        this.registerHandlers();
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Recursively removes nav items whose `meta.domain` the user cannot view.
     * Collapsable groups with no visible children are also removed.
     */
    private _filterByDomain(items: FuseNavigationItem[]): FuseNavigationItem[] {
        const result: FuseNavigationItem[] = [];

        for (const item of items) {
            const domain: string | undefined = (item as any).meta?.domain;

            // Items with a domain code: check canView
            if (domain) {
                if (!this._claimsService.canView(domain)) {
                    continue; // skip — user has no view access
                }
                result.push(item);
                continue;
            }

            // Collapsable / group items: filter children, keep only if non-empty
            if (item.children && item.children.length > 0) {
                const filteredChildren = this._filterByDomain(item.children);
                if (filteredChildren.length === 0) {
                    continue; // all children hidden → hide the group too
                }
                result.push({ ...item, children: filteredChildren });
                continue;
            }

            // Items without a domain (dashboard group header, etc.) — always visible
            result.push(item);
        }

        return result;
    }

    // ─── Mock API ─────────────────────────────────────────────────────────────

    registerHandlers(): void {
        this._fuseMockApiService.onGet('api/common/navigation').reply(() => {
            // Deep-clone to avoid mutating the original static arrays
            const defaultClone = cloneDeep(this._defaultNavigation);
            const filtered = this._filterByDomain(defaultClone);

            // Fill compact navigation children using filtered default navigation
            const compactClone = cloneDeep(this._compactNavigation);
            compactClone.forEach((compactNavItem) => {
                filtered.forEach((defaultNavItem) => {
                    if (defaultNavItem.id === compactNavItem.id) {
                        compactNavItem.children = cloneDeep(defaultNavItem.children);
                    }
                });
            });

            // Fill futuristic navigation children using filtered default navigation
            const futuristicClone = cloneDeep(this._futuristicNavigation);
            futuristicClone.forEach((futuristicNavItem) => {
                filtered.forEach((defaultNavItem) => {
                    if (defaultNavItem.id === futuristicNavItem.id) {
                        futuristicNavItem.children = cloneDeep(defaultNavItem.children);
                    }
                });
            });

            // Fill horizontal navigation children using filtered default navigation
            const horizontalClone = cloneDeep(this._horizontalNavigation);
            horizontalClone.forEach((horizontalNavItem) => {
                filtered.forEach((defaultNavItem) => {
                    if (defaultNavItem.id === horizontalNavItem.id) {
                        horizontalNavItem.children = cloneDeep(defaultNavItem.children);
                    }
                });
            });

            return [
                200,
                {
                    compact: compactClone,
                    default: filtered,
                    futuristic: futuristicClone,
                    horizontal: horizontalClone,
                },
            ];
        });
    }
}
