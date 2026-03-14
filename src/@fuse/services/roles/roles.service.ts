import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@fuse/environments/environment';

export interface RoleDto {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    isActive: boolean;
}

export interface DomainDto {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    isActive: boolean;
}

export interface ClaimDto {
    id: number;
    code: string;
    name: string;
    domainId: number;
    domainCode: string;
    domainName: string;
    description?: string | null;
    icon?: string | null;
    isActive: boolean;
}

export interface RoleUpsertRequest {
    code: string;
    name: string;
    description?: string | null;
    icon?: string | null;
    isActive: boolean;
}

export interface RoleClaimRowDto {
    domainId: number;
    domainCode: string;
    domainName: string;
    claimId: number;
    claimCode: string;
    claimName: string;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    isActive: boolean;
}

export interface UpdateRoleClaimRequest {
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
    isActive: boolean;
}

export interface RoleUserDto {
    id: number;          // BOUserId
    userId: number;
    fullName: string;
    email?: string | null;
    image?: string | null;
    isActive: boolean;
}

export interface AdminRowDto {
    boUserId: number;
    userId: number;
    fullName: string;
    firstname?: string | null;
    lastname?: string | null;
    code?: string | null;
    email?: string | null;
    image?: string | null;
    roleId: number;
    roleName: string;
    isActive: boolean;
    mobile?: string | null;
}

export interface AvailableUserDto {
    id: number;
    firstname?: string | null;
    lastname?: string | null;
    fullName: string;
    code?: string | null;
    email?: string | null;
    image?: string | null;
    isActive: boolean;
}

export interface UserClaimOverrideRowDto {
    domainId: number;
    domainCode: string;
    domainName: string;
    claimId: number;
    claimCode: string;
    claimName: string;
    roleCanView: boolean;
    roleCanEdit: boolean;
    roleCanDelete: boolean;
    overrideCanView: boolean | null;
    overrideCanEdit: boolean | null;
    overrideCanDelete: boolean | null;
    effectiveCanView: boolean;
    effectiveCanEdit: boolean;
    effectiveCanDelete: boolean;
}

export interface UpsertUserClaimOverrideRequest {
    claimId: number;
    overrideCanView: boolean | null;
    overrideCanEdit: boolean | null;
    overrideCanDelete: boolean | null;
}

@Injectable({ providedIn: 'root' })
export class RolesService {
    private http = inject(HttpClient);
    private readonly baseUrl = environment.apiUrl + '/boRoles';

    getRoles() {
        return this.http.get<RoleDto[]>(`${this.baseUrl}/roles`);
    }

    createRole(req: RoleUpsertRequest) {
        return this.http.post<RoleDto>(`${this.baseUrl}/roles`, req);
    }

    updateRole(roleId: number, req: RoleUpsertRequest) {
        return this.http.put<RoleDto>(`${this.baseUrl}/roles/${roleId}`, req);
    }

    deleteRole(roleId: number) {
        return this.http.delete<void>(`${this.baseUrl}/roles/${roleId}`);
    }

    getDomains() {
        return this.http.get<DomainDto[]>(`${this.baseUrl}/domains`);
    }

    getClaims() {
        return this.http.get<ClaimDto[]>(`${this.baseUrl}/claims`);
    }

    getRoleClaims(roleId: number) {
        return this.http.get<RoleClaimRowDto[]>(`${this.baseUrl}/roles/${roleId}/claims`);
    }

    updateRoleClaim(roleId: number, claimId: number, req: UpdateRoleClaimRequest) {
        return this.http.put<RoleClaimRowDto>(`${this.baseUrl}/roles/${roleId}/claims/${claimId}`, req);
    }

    updateRoleClaimsBatch(roleId: number, changes: Array<UpdateRoleClaimRequest & { claimId: number }>) {
        return this.http.put<void>(`${this.baseUrl}/roles/${roleId}/claims/batch`, changes);
    }

    getRoleUsers(roleId: number) {
        return this.http.get<RoleUserDto[]>(`${this.baseUrl}/roles/${roleId}/users`);
    }

    getAdministrators() {
        return this.http.get<AdminRowDto[]>(`${this.baseUrl}/admins`);
    }

    updateAdministratorRole(boUserId: number, roleId: number) {
        return this.http.put<void>(`${this.baseUrl}/admins/${boUserId}/role`, { roleId });
    }

    addAdministrator(userId: number, roleId: number) {
        return this.http.post<void>(`${this.baseUrl}/admins`, { userId, roleId });
    }

    removeAdministrator(boUserId: number) {
        return this.http.delete<void>(`${this.baseUrl}/admins/${boUserId}`);
    }

    getAvailableUsersForAdmin() {
        return this.http.get<AvailableUserDto[]>(`${this.baseUrl}/admins/available-users`);
    }

    removeUserFromRole(roleId: number, boUserId: number) {
        return this.http.delete<void>(`${this.baseUrl}/roles/${roleId}/users/${boUserId}`);
    }

    getUserClaimsWithOverrides(boUserId: number) {
        return this.http.get<UserClaimOverrideRowDto[]>(`${this.baseUrl}/admins/${boUserId}/claims`);
    }

    saveUserClaimOverridesBatch(boUserId: number, items: UpsertUserClaimOverrideRequest[]) {
        return this.http.put<void>(`${this.baseUrl}/admins/${boUserId}/claims/overrides`, items);
    }
}