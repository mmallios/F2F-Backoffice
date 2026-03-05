import { CommonModule } from '@angular/common';
import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    OnDestroy,
    OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';

import { Subject, of, map, switchMap, takeUntil, catchError, finalize } from 'rxjs';

import { UsersService, User } from '@fuse/services/users/users.service';
import { GroupChatsService, GroupChat, GroupMessageDto } from '@fuse/services/groupchats/groupchats.service';
import { EventsService, EventItem } from '@fuse/services/events/events.service';

import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

type ChatMessageView = {
    id: string;
    userId: number;
    value: string;
    createdAt: string;      // ISO
    createdMs: number;      // cached for speed
    senderName: string;
    senderAvatar: string;
};

@Component({
    selector: 'groupchat-details',
    standalone: true,
    imports: [
        CommonModule,
        RouterModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatTabsModule,
        MatChipsModule,
        MatMenuModule,
        MatDatepickerModule,
        MatNativeDateModule
    ],
    templateUrl: './groupchat-details.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupChatDetailsComponent implements OnInit, OnDestroy {
    private readonly _destroy$ = new Subject<void>();

    loading = true;

    groupChat: GroupChat | null = null;

    form = this._fb.group({
        id: [0, Validators.required],
        code: ['', Validators.required],
        name: ['', Validators.required],
        description: [''],
        image: [''],
        eventId: [null as number | null],
        isMain: [false],
        isActive: [true],
    });

    chatFilters = this._fb.group({
        fromDate: [null as Date | null],
        toDate: [null as Date | null],
        fromTime: ['00:00'],
        toTime: ['23:59'],
        userIds: [[] as number[]],
    });

    messageInput = this._fb.control<string>('');

    private readonly _adminCode = 'f2f-admin';

    // users cache
    users: User[] = [];
    private _userById = new Map<number, any>();

    // events cache (dropdown)
    events: EventItem[] = [];
    private _eventById = new Map<number, EventItem>();

    // precomputed view-models
    messagesView: ChatMessageView[] = [];
    filteredView: ChatMessageView[] = [];
    sendersForFilter: { id: number; name: string }[] = [];
    usersWhoMessaged: { userId: number; count: number; lastAt?: string }[] = [];

    private readonly _takeDefault = 200;

    saving = false;
    saveError: string | null = null;

    constructor(
        private _route: ActivatedRoute,
        private _router: Router,
        private _cdr: ChangeDetectorRef,
        private _fb: FormBuilder,
        private _groupChatsService: GroupChatsService,
        private _usersService: UsersService,
        private _eventsService: EventsService
    ) { }

    ngOnInit(): void {
        const id = Number(this._route.snapshot.paramMap.get('id'));
        if (!id) {
            this.loading = false;
            this._router.navigateByUrl('/apps/groupchats');
            return;
        }

        // ✅ Load events ONCE (does not block page)
        this.loadEventsOnce();

        // Load users once + build cache map
        this._usersService.loadUsers().pipe(takeUntil(this._destroy$)).subscribe();
        this._usersService.users$
            .pipe(takeUntil(this._destroy$), catchError(() => of([] as any[])))
            .subscribe((users) => {
                this.users = (users ?? []) as any;
                this._userById.clear();
                for (const u of this.users as any[]) this._userById.set(Number(u.id), u);

                // refresh message sender fields (cheap)
                if (this.messagesView.length) {
                    this.messagesView = this.messagesView.map(m => ({
                        ...m,
                        senderName: this.computeUserName(m.userId),
                        senderAvatar: this.computeUserAvatar(m.userId),
                    }));
                    this.rebuildDerivedLists();
                }

                this._cdr.markForCheck();
            });

        this.loading = true;

        // Load group + messages
        this._groupChatsService.getAll()
            .pipe(
                map(list => (list ?? []).find((x: any) => Number(x.id) === id) ?? null),
                switchMap(group => {
                    if (!group) return of({ group: null as any, msgs: [] as GroupMessageDto[] });

                    this.groupChat = group;

                    this.form.patchValue({
                        id: group.id,
                        code: group.code ?? '',
                        name: group.name ?? '',
                        description: group.description ?? '',
                        image: group.image ?? '',
                        eventId: (group.eventId ?? null) as any,
                        isMain: !!group.isMain,
                        isActive: !!group.isActive,
                    });

                    return this._groupChatsService.getMessages(id, this._takeDefault, null).pipe(
                        catchError(() => of([] as GroupMessageDto[])),
                        map(msgs => ({ group, msgs }))
                    );
                }),
                finalize(() => {
                    this.loading = false;
                    this._cdr.markForCheck();
                }),
                catchError(err => {
                    console.error('GroupChatDetails error:', err);
                    return of({ group: null as any, msgs: [] as GroupMessageDto[] });
                }),
                takeUntil(this._destroy$)
            )
            .subscribe(({ group, msgs }) => {
                if (!group) {
                    this._router.navigateByUrl('/apps/groupchats');
                    return;
                }

                // map ONCE
                this.messagesView = (msgs ?? [])
                    .map(m => this.mapDtoToView(m))
                    .filter(m => !!m.id && m.createdMs > 0)
                    .sort((a, b) => a.createdMs - b.createdMs);

                this.rebuildDerivedLists();
                this._cdr.markForCheck();
            });

        // Recompute filtered list when filters change
        this.chatFilters.valueChanges
            .pipe(takeUntil(this._destroy$))
            .subscribe(() => {
                this.rebuildFiltered();
                this._cdr.markForCheck();
            });
    }

    ngOnDestroy(): void {
        this._destroy$.next();
        this._destroy$.complete();
    }

    // ---------------- Events ----------------
    private loadEventsOnce(): void {
        this._eventsService.getEvents(false)
            .pipe(
                takeUntil(this._destroy$),
                catchError((err) => {
                    console.error('getEvents failed:', err);
                    return of([] as EventItem[]);
                })
            )
            .subscribe((events) => {
                const evs = (events ?? []) as EventItem[];

                // sort latest first (optional)
                this.events = evs
                    .slice()
                    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

                this._eventById.clear();
                for (const e of this.events) this._eventById.set(Number(e.id), e);

                this._cdr.markForCheck();
            });
    }

    eventTitleById(eventId: number | null): string {
        const id = Number(eventId ?? 0);
        if (!id) return '— Χωρίς event —';
        const ev = this._eventById.get(id);
        if (!ev) return `Event #${id}`;
        return `${ev.homeTeamName} - ${ev.awayTeamName}`;
    }

    eventMetaById(eventId: number | null): string {
        const id = Number(eventId ?? 0);
        if (!id) return '';
        const ev = this._eventById.get(id);
        if (!ev) return '';
        return `${this.formatEventDate(ev.eventDate)} • ${ev.competitionName ?? '-'}`;
    }

    formatEventDate(v: string): string {
        const d = new Date(v);
        if (isNaN(d.getTime())) return '-';
        return new Intl.DateTimeFormat('el-GR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(d);
    }

    // ---------------- Derived lists ----------------
    private rebuildSendersForFilter(): void {
        const ids = new Set<number>();
        for (const m of this.messagesView) ids.add(Number(m.userId));

        this.sendersForFilter = Array.from(ids)
            .map(id => ({ id, name: this.computeUserName(id) }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    private rebuildUsersWhoMessaged(): void {
        const mapCount = new Map<number, { count: number; lastAt?: string; lastMs: number }>();

        for (const m of this.messagesView) {
            const uid = Number(m.userId);
            const item = mapCount.get(uid) ?? { count: 0, lastAt: undefined, lastMs: 0 };
            item.count += 1;

            if (m.createdMs >= item.lastMs) {
                item.lastMs = m.createdMs;
                item.lastAt = m.createdAt;
            }
            mapCount.set(uid, item);
        }

        this.usersWhoMessaged = Array.from(mapCount.entries())
            .map(([userId, meta]) => ({ userId, count: meta.count, lastAt: meta.lastAt }))
            .sort((a, b) => b.count - a.count);
    }

    private rebuildDerivedLists(): void {
        this.rebuildFiltered();
        this.rebuildSendersForFilter();
        this.rebuildUsersWhoMessaged();
    }

    // ---------------- Mapping ----------------
    private mapDtoToView(m: GroupMessageDto): ChatMessageView {
        const createdAt = String((m as any).sentAtUtc ?? (m as any).SentAtUtc ?? '');
        const createdMs = this.safeMs(createdAt);

        const userId = Number((m as any).senderUserId ?? (m as any).SenderUserId ?? 0);

        const isDeleted = !!((m as any).isDeleted ?? (m as any).IsDeleted ?? false);
        const body = String((m as any).body ?? (m as any).Body ?? '');

        return {
            id: String((m as any).id ?? (m as any).Id ?? ''),
            userId,
            value: isDeleted ? '<i>Το μήνυμα διαγράφηκε</i>' : body,
            createdAt,
            createdMs,
            senderName: this.computeUserName(userId),
            senderAvatar: this.computeUserAvatar(userId),
        };
    }

    private safeMs(v: any): number {
        const t = new Date(v).getTime();
        return isNaN(t) ? 0 : t;
    }

    private computeUserName(userId: number): string {
        const u: any = this._userById.get(Number(userId));
        if (!u) return `User #${userId}`;
        const first = String(u.firstname ?? '').trim();
        const last = String(u.lastname ?? '').trim();
        const full = `${first} ${last}`.trim();
        return full || u.email || `User #${userId}`;
    }

    private computeUserAvatar(userId: number): string {
        const u: any = this._userById.get(Number(userId));
        return String(u?.image ?? u?.avatar ?? '');
    }

    // ---------------- Used in HTML ----------------
    getUserName(userId: number): string { return this.computeUserName(userId); }
    getUserImage(userId: number): string { return this.computeUserAvatar(userId); }
    getUserInitial(userId: number): string {
        const u = this.computeUserName(userId);
        return (u.charAt(0) || '?').toUpperCase();
    }
    getUserFullName(userId: number): string { return this.computeUserName(userId); }
    getUserEmail(userId: number): string {
        const u: any = this._userById.get(Number(userId));
        return u?.email ?? u?.username ?? `user${userId}@unknown.local`;
    }

    // ---------------- Actions ----------------
    back(): void {
        this._router.navigateByUrl('/apps/groupchats');
    }

    clearChatFilters(): void {
        this.chatFilters.patchValue({
            fromDate: null,
            toDate: null,
            fromTime: '00:00',
            toTime: '23:59',
            userIds: [],
        });
    }



    triggerFileInput(input: HTMLInputElement): void {
        input.click();
    }

    onFileSelected(ev: Event): void {
        const input = ev.target as HTMLInputElement;
        const file = input.files?.[0];
        if (!file) return;
        input.value = '';

        if (!file.type.startsWith('image/')) return;
        if (file.size > 3 * 1024 * 1024) return;

        const r = new FileReader();
        r.onload = () => this.form.patchValue({ image: String(r.result || '') });
        r.readAsDataURL(file);
    }

    removeImage(): void {
        this.form.patchValue({ image: '' });
    }

    private buildDateTime(date: Date | null, time: string): number | null {
        if (!date) return null;
        const [h, m] = time.split(':').map(Number);
        const d = new Date(date);
        d.setHours(h ?? 0, m ?? 0, 0, 0);
        return d.getTime();
    }

    rebuildFiltered(): void {
        const v = this.chatFilters.getRawValue();

        const fromTs = this.buildDateTime(v.fromDate ?? null, v.fromTime || '00:00');
        const toTs = this.buildDateTime(v.toDate ?? null, v.toTime || '23:59');

        const selected = (v.userIds ?? []).map(Number);

        this.filteredView = (this.messagesView ?? []).filter((m) => {
            const t = m.createdMs;

            if (fromTs !== null && t < fromTs) return false;
            if (toTs !== null && t > toTs) return false;

            if (selected.length && !selected.includes(Number(m.userId))) return false;

            return true;
        });
    }
    save(): void {
        const id = Number(this.form.value.id ?? 0);
        if (!id) return;

        // ✅ only update what you care about (event + optional others)
        const dto = {
            name: this.form.value.name ?? null,
            description: this.form.value.description ?? null,
            eventId: this.form.value.eventId ?? null,
            isMain: !!this.form.value.isMain,
            image: this.form.value.image ?? null,
            isActive: !!this.form.value.isActive,
        };

        this.saving = true;
        this.saveError = null;
        this._cdr.markForCheck();

        this._groupChatsService.updateGroupChat(id, dto)
            .pipe(
                takeUntil(this._destroy$),
                finalize(() => {
                    this.saving = false;
                    this._cdr.markForCheck();
                }),
                catchError((err) => {
                    console.error('updateGroupChat failed:', err);
                    this.saveError = 'Αποτυχία αποθήκευσης. Δοκίμασε ξανά.';
                    return of(null);
                })
            )
            .subscribe((res) => {
                if (!res) return;

                // optional: update local header name immediately
                if (this.groupChat) {
                    this.groupChat = {
                        ...this.groupChat,
                        name: String(this.form.value.name ?? this.groupChat.name ?? ''),
                        description: String(this.form.value.description ?? this.groupChat.description ?? ''),
                        eventId: (this.form.value.eventId ?? null) as any,
                        isMain: !!this.form.value.isMain,
                        isActive: !!this.form.value.isActive,
                        image: String(this.form.value.image ?? this.groupChat.image ?? ''),
                    };
                }
            });
    }

    private getAdminUser(): User | null {
        // depends on your model property name: code vs Code
        const u: any = (this.users ?? []).find((x: any) =>
            String(x?.code ?? x?.Code ?? '').toLowerCase() === this._adminCode
        );
        return u ?? null;
    }

    private getAdminUserId(): number | null {
        const u: any = this.getAdminUser();
        const id = Number(u?.id ?? u?.Id ?? 0);
        return id > 0 ? id : null;
    }

    sendMessage(): void {
        const groupId = Number(this.form.value.id ?? 0);
        if (!groupId) return;

        const body = (this.messageInput.value ?? '').trim();
        if (!body) return;

        const adminUserId = this.getAdminUserId();
        if (!adminUserId) {
            // optional: show toast/snackbar
            console.error("Admin user with code 'f2f-admin' not found in users cache.");
            return;
        }

        // optimistic UI (optional)
        const tmpId = `tmp_${Date.now()}`;
        const now = new Date().toISOString();

        const optimistic: ChatMessageView = {
            id: tmpId,
            userId: adminUserId,
            value: body,
            createdAt: now,
            createdMs: this.safeMs(now),
            senderName: this.computeUserName(adminUserId),
            senderAvatar: this.computeUserAvatar(adminUserId),
        };

        this.messagesView = [...this.messagesView, optimistic];
        this.rebuildDerivedLists();
        this.messageInput.setValue('');
        this._cdr.markForCheck();

        // send to backend
        const dto = {
            senderUserId: adminUserId,
            body,
            replyToMessageId: null as string | null,
        };

        this._groupChatsService
            .addMessage(groupId, dto)
            .pipe(
                takeUntil(this._destroy$),
                catchError((err) => {
                    console.error('AddMessage failed', err);

                    // rollback optimistic message
                    this.messagesView = this.messagesView.filter(x => x.id !== tmpId);
                    this.rebuildDerivedLists();
                    this._cdr.markForCheck();

                    return of(null);
                })
            )
            .subscribe((created) => {
                if (!created) return;

                // replace optimistic with real one
                const real = this.mapDtoToView(created);

                this.messagesView = this.messagesView
                    .filter(x => x.id !== tmpId)
                    .concat(real)
                    .sort((a, b) => a.createdMs - b.createdMs);

                this.rebuildDerivedLists();
                this._cdr.markForCheck();
            });
    }

    onEnterSend(e: KeyboardEvent) {
        if (e.shiftKey) return;
        e.preventDefault();
        this.sendMessage();
    }


}
