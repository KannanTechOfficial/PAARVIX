/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { AdminApiService, type AdminUser, type Role, errorText } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { DashboardsApiService, type DashboardItem } from '../../core/services/dashboards-api.service';
import { IconComponent } from '../../core/ui/icon.component';

interface Draft { name: string; email: string; password: string; roleId: string; language: string; department: string }

const emptyDraft = (roleId = ''): Draft => ({ name: '', email: '', password: '', roleId, language: 'en', department: '' });

@Component({
  selector: 'pvx-admin-users',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, IconComponent],
  template: `
    <div class="pvx-page">
      <header class="pvx-page-head">
        <div>
          <h1>{{ 'admin.users.title' | translate }}</h1>
          <p>{{ 'admin.users.subtitle' | translate }}</p>
        </div>
        @if (canWrite()) {
          <div class="actions">
            <button class="pvx-btn primary" type="button" (click)="openAdd()" [disabled]="adding()">
              <pvx-icon name="plus" [size]="18" />{{ 'admin.users.add' | translate }}
            </button>
          </div>
        }
      </header>

      @if (error()) { <p class="pvx-note error" role="alert">{{ error() }}</p> }
      @if (notice()) { <p class="pvx-note ok" role="status">{{ notice() }}</p> }

      @if (adding()) {
        <form class="pvx-panel add" (ngSubmit)="create()" #f="ngForm">
          <h2>{{ 'admin.users.addTitle' | translate }}</h2>
          <div class="grid">
            <label class="pvx-field"><span>{{ 'admin.users.name' | translate }}</span>
              <input class="pvx-input" name="name" [(ngModel)]="draft.name" required minlength="2" maxlength="100" autocomplete="off" /></label>
            <label class="pvx-field"><span>{{ 'admin.users.email' | translate }}</span>
              <input class="pvx-input" name="email" type="email" [(ngModel)]="draft.email" required autocomplete="off" /></label>
            <label class="pvx-field"><span>{{ 'admin.users.password' | translate }}</span>
              <input class="pvx-input" name="password" type="password" [(ngModel)]="draft.password" required minlength="8" autocomplete="new-password" />
              <small>{{ 'admin.users.passwordHint' | translate }}</small></label>
            <label class="pvx-field"><span>{{ 'admin.users.role' | translate }}</span>
              <select class="pvx-select" name="roleId" [(ngModel)]="draft.roleId" required>
                @for (r of assignable(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
              </select></label>
            <label class="pvx-field"><span>{{ 'admin.users.department' | translate }}</span>
              <input class="pvx-input" name="department" [(ngModel)]="draft.department" maxlength="80" />
              <small>{{ 'admin.users.departmentHint' | translate }}</small></label>
            <label class="pvx-field"><span>{{ 'admin.users.language' | translate }}</span>
              <select class="pvx-select" name="language" [(ngModel)]="draft.language">
                <option value="en">English</option><option value="ta">தமிழ்</option>
              </select></label>
          </div>
          <div class="row-actions">
            <button class="pvx-btn primary" type="submit" [disabled]="busy() || !f.valid">{{ 'admin.users.create' | translate }}</button>
            <button class="pvx-btn ghost" type="button" (click)="adding.set(false)">{{ 'common.cancel' | translate }}</button>
          </div>
        </form>
      }

      <div class="pvx-table-wrap">
        <table class="pvx-table">
          <caption class="pvx-sr-only">{{ 'admin.users.title' | translate }}</caption>
          <thead><tr>
            <th scope="col">{{ 'admin.users.name' | translate }}</th>
            <th scope="col">{{ 'admin.users.role' | translate }}</th>
            <th scope="col">{{ 'admin.users.department' | translate }}</th>
            <th scope="col">{{ 'admin.users.home' | translate }}</th>
            <th scope="col">{{ 'admin.users.attributes' | translate }}</th>
            <th scope="col">{{ 'admin.users.status' | translate }}</th>
            @if (canWrite()) { <th scope="col"><span class="pvx-sr-only">{{ 'admin.actions' | translate }}</span></th> }
          </tr></thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr [class.inactive]="!u.isActive">
                <td>
                  <div class="who"><strong>{{ u.name }}</strong>
                    @if (u.id === me()?.id) { <span class="pvx-tag brand">{{ 'admin.users.you' | translate }}</span> }</div>
                  <div class="email">{{ u.email }}</div>
                </td>
                <td>
                  @if (canWrite() && editable(u)) {
                    <label class="pvx-sr-only" [for]="'role-' + u.id">{{ 'admin.users.role' | translate }}</label>
                    <select class="pvx-select inline" [id]="'role-' + u.id" [ngModel]="u.assignedRole?.id" (ngModelChange)="changeRole(u, $event)" [disabled]="busy()">
                      @for (r of assignable(); track r.id) { <option [value]="r.id">{{ r.name }}</option> }
                    </select>
                  } @else {
                    <span class="pvx-tag" [class.brand]="u.assignedRole?.key === 'super_admin'">
                      @if (u.assignedRole?.key === 'super_admin') { <pvx-icon name="lock" [size]="13" /> }
                      {{ u.assignedRole?.name ?? ('admin.users.noRole' | translate) }}
                    </span>
                  }
                </td>
                <td>{{ u.department || '—' }}</td>
                <td>
                  @if (canWrite() && editable(u)) {
                    <label class="pvx-sr-only" [for]="'home-' + u.id">{{ 'admin.users.home' | translate }}</label>
                    <select class="pvx-select inline" [id]="'home-' + u.id" [ngModel]="u.homeDashboardId ?? ''" (ngModelChange)="changeHome(u, $event)" [disabled]="busy()">
                      <option value="">{{ 'admin.users.homeRole' | translate }}</option>
                      @for (d of dashboards(); track d.id) { <option [value]="d.id">{{ d.title }}</option> }
                    </select>
                  } @else {
                    {{ homeTitle(u) }}
                  }
                </td>
                <td>
                  @if (canWrite() && editable(u)) {
                    <label class="pvx-sr-only" [for]="'attr-' + u.id">{{ 'admin.users.attributes' | translate }}</label>
                    <input class="pvx-input attrs" [id]="'attr-' + u.id" [value]="attrText(u)" (change)="saveAttributes(u, $any($event.target).value)"
                      [placeholder]="'admin.users.attributesHint' | translate" [disabled]="busy()" spellcheck="false" />
                  } @else {
                    <span class="attrs-text">{{ attrText(u) || '—' }}</span>
                  }
                </td>
                <td>
                  @if (u.isActive) { <span class="pvx-tag ok">{{ 'admin.users.active' | translate }}</span> }
                  @else { <span class="pvx-tag">{{ 'admin.users.inactive' | translate }}</span> }
                </td>
                @if (canWrite()) {
                  <td class="end">
                    @if (editable(u)) {
                      @if (resetFor() === u.id) {
                        <form class="reset" (ngSubmit)="savePassword(u)">
                          <label class="pvx-sr-only" [for]="'pw-' + u.id">{{ 'admin.users.newPassword' | translate }}</label>
                          <input class="pvx-input" [id]="'pw-' + u.id" name="pw" type="password" minlength="8" [(ngModel)]="newPassword"
                            [placeholder]="'admin.users.newPassword' | translate" autocomplete="new-password" />
                          <button class="pvx-btn small primary" type="submit" [disabled]="busy() || newPassword.length < 8">{{ 'common.save' | translate }}</button>
                          <button class="pvx-btn small ghost" type="button" (click)="resetFor.set(null)">{{ 'common.cancel' | translate }}</button>
                        </form>
                      } @else {
                        <button class="pvx-btn small ghost" type="button" (click)="startReset(u)">{{ 'admin.users.resetPassword' | translate }}</button>
                        <button class="pvx-btn small ghost" type="button" (click)="signOutEverywhere(u)" [disabled]="busy()"
                          [attr.title]="'admin.users.signOutEverywhereHint' | translate">{{ 'admin.users.signOutEverywhere' | translate }}</button>
                        @if (u.id !== me()?.id) {
                          <button class="pvx-btn small" [class.danger]="u.isActive" type="button" (click)="toggleActive(u)" [disabled]="busy()">
                            {{ (u.isActive ? 'admin.users.deactivate' : 'admin.users.activate') | translate }}
                          </button>
                        }
                      }
                    }
                  </td>
                }
              </tr>
            } @empty {
              <tr><td colspan="7" class="pvx-empty">{{ (loading() ? 'common.loading' : 'admin.users.empty') | translate }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .add { padding: 20px 24px; margin-bottom: 24px; }
    .add h2 { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px 20px; }
    .row-actions { display: flex; gap: 8px; margin-top: 20px; }
    .pvx-note { margin-bottom: 16px; }
    .who { display: flex; align-items: center; gap: 8px; padding-top: 10px; }
    .email { font-size: 13px; color: var(--pvx-text-muted); padding-bottom: 10px; }
    .pvx-select.inline { min-height: 34px; width: auto; min-width: 150px; }
    td.end { text-align: right; white-space: nowrap; }
    td.end .pvx-btn + .pvx-btn { margin-left: 6px; }
    .reset { display: inline-flex; gap: 6px; align-items: center; }
    .reset .pvx-input { min-height: 32px; width: 180px; }
    .attrs { min-height: 34px; width: 210px; font: 13px var(--pvx-font-code); }
    .attrs-text { font: 13px var(--pvx-font-code); color: var(--pvx-text-muted); }
  `],
})
export class UsersComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly t = inject(TranslateService);
  private readonly dashApi = inject(DashboardsApiService);
  readonly dashboards = signal<DashboardItem[]>([]);

  readonly users = signal<AdminUser[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly adding = signal(false);
  readonly resetFor = signal<string | null>(null);
  readonly me = this.auth.user;
  readonly canWrite = computed(() => this.auth.can('users:write'));

  /** Only a Super Admin may hand out or change Super Admin; the API enforces the same rule. */
  readonly assignable = computed(() =>
    this.roles().filter((r) => r.key !== 'super_admin' || this.auth.isSuperAdmin()),
  );

  draft: Draft = emptyDraft();
  newPassword = '';

  ngOnInit() {
    this.load();
    this.dashApi.list().subscribe({ next: (d) => this.dashboards.set(d.filter((x) => !x.template)), error: () => undefined });
  }

  /** Shown and edited as "reg_no=23CS001, district=Madurai". */
  attrText(u: AdminUser): string {
    return Object.entries(u.attributes ?? {}).map(([k, v]) => `${k}=${v}`).join(', ');
  }

  saveAttributes(u: AdminUser, text: string) {
    const attributes: Record<string, string> = {};
    for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
      const i = part.indexOf('=');
      if (i < 1) {
        this.notice.set('');
        this.error.set(this.t.instant('admin.users.attributesBad', { part }));
        return;
      }
      attributes[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    }
    this.busy.set(true);
    this.api.updateUser(u.id, { attributes }).subscribe({
      next: (r) => this.done(this.t.instant('admin.users.attributesSaved', { name: r.name })),
      error: (e) => {
        this.fail(e);
        this.load();
      },
    });
  }

  homeTitle(u: AdminUser): string {
    return this.dashboards().find((d) => d.id === u.homeDashboardId)?.title ?? this.t.instant('admin.users.homeRole');
  }

  /** A personal home dashboard, overriding the role's. Empty follows the role. */
  changeHome(u: AdminUser, dashboardId: string) {
    this.busy.set(true);
    this.api.updateUser(u.id, { homeDashboardId: dashboardId || null }).subscribe({
      next: (r) => this.done(this.t.instant('admin.users.homeChanged', { name: r.name })),
      error: (e) => {
        this.fail(e);
        this.load();
      },
    });
  }

  editable(u: AdminUser): boolean {
    return u.assignedRole?.key !== 'super_admin' || this.auth.isSuperAdmin();
  }

  private load() {
    this.loading.set(true);
    forkJoin({ users: this.api.users(), roles: this.api.roles() }).subscribe({
      next: ({ users, roles }) => {
        this.users.set(users);
        this.roles.set(roles);
        this.loading.set(false);
      },
      error: (e) => {
        this.error.set(errorText(e));
        this.loading.set(false);
      },
    });
  }

  private done(message: string) {
    this.busy.set(false);
    this.error.set('');
    this.notice.set(message);
    this.load();
  }

  private fail(e: unknown) {
    this.busy.set(false);
    this.notice.set('');
    this.error.set(errorText(e));
  }

  openAdd() {
    const viewer = this.roles().find((r) => r.key === 'viewer');
    this.draft = emptyDraft(viewer?.id ?? this.assignable()[0]?.id ?? '');
    this.adding.set(true);
  }

  create() {
    this.busy.set(true);
    const d = this.draft;
    this.api.createUser({ ...d, department: d.department.trim() || null }).subscribe({
      next: (u) => {
        this.adding.set(false);
        this.done(this.t.instant('admin.users.added', { name: u.name }));
      },
      error: (e) => this.fail(e),
    });
  }

  changeRole(u: AdminUser, roleId: string) {
    this.busy.set(true);
    this.api.updateUser(u.id, { roleId }).subscribe({
      next: (r) => {
        if (u.id === this.me()?.id) this.auth.reloadUser().subscribe();
        this.done(this.t.instant('admin.users.roleChanged', { name: r.name, role: r.assignedRole?.name ?? '' }));
      },
      error: (e) => {
        this.fail(e);
        this.load();
      },
    });
  }

  toggleActive(u: AdminUser) {
    this.busy.set(true);
    this.api.updateUser(u.id, { isActive: !u.isActive }).subscribe({
      next: (r) => this.done(this.t.instant(r.isActive ? 'admin.users.activated' : 'admin.users.deactivated', { name: r.name })),
      error: (e) => this.fail(e),
    });
  }

  /** For a lost phone or laptop: ends every session this person has, on the server. */
  signOutEverywhere(u: AdminUser) {
    this.busy.set(true);
    this.api.revokeSessions(u.id).subscribe({
      next: (r) => this.done(this.t.instant('admin.users.signedOutEverywhere', { name: u.name, count: r.ended })),
      error: (e) => this.fail(e),
    });
  }

  startReset(u: AdminUser) {
    this.newPassword = '';
    this.resetFor.set(u.id);
  }

  savePassword(u: AdminUser) {
    this.busy.set(true);
    this.api.setPassword(u.id, this.newPassword).subscribe({
      next: () => {
        this.resetFor.set(null);
        this.newPassword = '';
        this.done(this.t.instant('admin.users.passwordChanged', { name: u.name }));
      },
      error: (e) => this.fail(e),
    });
  }
}
