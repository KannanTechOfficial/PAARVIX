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
import { AdminApiService, type PermissionCatalog, type Role, errorText } from '../../core/services/admin-api.service';
import { AuthService } from '../../core/services/auth.service';
import { IconComponent } from '../../core/ui/icon.component';

interface Draft { id: string | null; name: string; description: string; permissions: Set<string> }

@Component({
  selector: 'pvx-admin-roles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TranslatePipe, IconComponent],
  template: `
    <div class="pvx-page">
      <header class="pvx-page-head">
        <div>
          <h1>{{ 'admin.roles.title' | translate }}</h1>
          <p>{{ 'admin.roles.subtitle' | translate }}</p>
        </div>
        @if (canWrite()) {
          <div class="actions">
            <button class="pvx-btn primary" type="button" (click)="startNew()"><pvx-icon name="plus" [size]="18" />{{ 'admin.roles.new' | translate }}</button>
          </div>
        }
      </header>

      @if (error()) { <p class="pvx-note error" role="alert">{{ error() }}</p> }
      @if (notice()) { <p class="pvx-note ok" role="status">{{ notice() }}</p> }

      <div class="layout">
        <nav class="list pvx-panel" [attr.aria-label]="'admin.roles.title' | translate">
          @for (r of roles(); track r.id) {
            <button type="button" class="role" [class.on]="selectedId() === r.id" (click)="select(r)" [attr.aria-current]="selectedId() === r.id ? 'true' : null">
              <span class="name">
                @if (r.isSystem) { <pvx-icon name="lock" [size]="14" /> }
                {{ r.name }}
              </span>
              <span class="meta pvx-num">{{ r.userCount === 1 ? ('admin.roles.userCountOne' | translate) : ('admin.roles.userCount' | translate: { count: r.userCount }) }} · {{ r.isSystem ? ('admin.roles.builtIn' | translate) : ('admin.roles.custom' | translate) }}</span>
            </button>
          }
          @if (draft()?.id === null) {
            <div class="role on"><span class="name">{{ draft()!.name || ('admin.roles.untitled' | translate) }}</span><span class="meta">{{ 'admin.roles.unsaved' | translate }}</span></div>
          }
        </nav>

        @if (draft(); as d) {
          <section class="editor pvx-panel">
            @if (readOnly()) {
              <div class="head">
                <div>
                  <h2>{{ d.name }}</h2>
                  <p class="desc">{{ d.description }}</p>
                </div>
                @if (canWrite() && current()?.key !== 'super_admin') {
                  <button class="pvx-btn" type="button" (click)="copy()"><pvx-icon name="copy" [size]="16" />{{ 'admin.roles.copy' | translate }}</button>
                }
              </div>
              <p class="pvx-note info">{{ (current()?.key === 'super_admin' ? 'admin.roles.superNote' : 'admin.roles.builtInNote') | translate }}</p>
            } @else {
              <div class="fields">
                <label class="pvx-field"><span>{{ 'admin.roles.name' | translate }}</span>
                  <input class="pvx-input" name="rname" [(ngModel)]="d.name" maxlength="60" /></label>
                <label class="pvx-field"><span>{{ 'admin.roles.description' | translate }}</span>
                  <input class="pvx-input" name="rdesc" [(ngModel)]="d.description" maxlength="200" /></label>
              </div>
            }

            @for (g of catalog()?.groups ?? []; track g.id) {
              <fieldset class="group">
                <legend>{{ 'admin.permGroups.' + g.id | translate }}</legend>
                @for (p of g.permissions; track p.id) {
                  <label class="pvx-check">
                    <input type="checkbox" [checked]="d.permissions.has(p.id)" (change)="toggle(p.id, $any($event.target).checked)"
                      [disabled]="readOnly() || !grantable(p.id)" />
                    <span>{{ 'admin.perms.' + p.id | translate }} <code>{{ p.id }}</code></span>
                  </label>
                }
              </fieldset>
            }

            @if (!readOnly()) {
              <div class="row-actions">
                <button class="pvx-btn primary" type="button" (click)="save()" [disabled]="busy() || d.name.trim().length < 2">{{ 'common.save' | translate }}</button>
                @if (d.id) {
                  <button class="pvx-btn danger" type="button" (click)="remove()" [disabled]="busy()">{{ 'admin.roles.delete' | translate }}</button>
                } @else {
                  <button class="pvx-btn ghost" type="button" (click)="cancelNew()">{{ 'common.cancel' | translate }}</button>
                }
              </div>
            }
          </section>
        } @else {
          <section class="editor pvx-panel pvx-empty">{{ (loading() ? 'common.loading' : 'admin.roles.pick') | translate }}</section>
        }
      </div>
    </div>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; align-items: start; }
    @media (max-width: 860px) { .layout { grid-template-columns: 1fr; } }
    .pvx-note { margin-bottom: 16px; }
    .list { padding: 6px; display: flex; flex-direction: column; gap: 2px; }
    .role { display: flex; flex-direction: column; gap: 2px; text-align: left; padding: 10px 12px; border-radius: calc(var(--pvx-radius) - 2px);
      border: 0; background: none; color: var(--pvx-text); font: inherit; cursor: pointer; }
    .role:hover { background: var(--pvx-bg-sunken); }
    .role.on { background: color-mix(in srgb, var(--pvx-primary) 10%, transparent); }
    .name { display: flex; align-items: center; gap: 6px; font-weight: 600; font-size: 14px; }
    .meta { font-size: 12px; color: var(--pvx-text-muted); }
    .editor { padding: 20px 24px; }
    .head { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px; }
    .head > div { flex: 1; }
    h2 { font-size: 18px; font-weight: 700; }
    .desc { color: var(--pvx-text-muted); font-size: 14px; margin-top: 4px; }
    .fields { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-bottom: 8px; }
    @media (max-width: 600px) { .fields { grid-template-columns: 1fr; } }
    .group { border: 0; border-top: 1px solid var(--pvx-border); padding: 16px 0 4px; margin-top: 16px; display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px 24px; }
    legend { font-size: 13px; font-weight: 700; padding-right: 12px; color: var(--pvx-text); }
    code { font: 12px var(--pvx-font-code); color: var(--pvx-text-muted); margin-left: 4px; }
    .row-actions { display: flex; gap: 8px; margin-top: 24px; }
  `],
})
export class RolesComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly t = inject(TranslateService);

  readonly roles = signal<Role[]>([]);
  readonly catalog = signal<PermissionCatalog | null>(null);
  readonly selectedId = signal<string | null>(null);
  readonly draft = signal<Draft | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly canWrite = computed(() => this.auth.can('roles:write'));
  readonly current = computed(() => this.roles().find((r) => r.id === this.selectedId()) ?? null);
  readonly readOnly = computed(() => {
    const d = this.draft();
    if (!d || !this.canWrite()) return true;
    if (d.id === null) return false;
    return this.current()?.isSystem ?? true;
  });

  ngOnInit() {
    this.load();
  }

  private load(selectId?: string) {
    forkJoin({ roles: this.api.roles(), catalog: this.api.permissions() }).subscribe({
      next: ({ roles, catalog }) => {
        this.roles.set(roles);
        this.catalog.set(catalog);
        this.loading.set(false);
        const pick = roles.find((r) => r.id === (selectId ?? this.selectedId())) ?? roles[0];
        if (pick) this.select(pick);
      },
      error: (e) => {
        this.loading.set(false);
        this.error.set(errorText(e));
      },
    });
  }

  /** You cannot grant a permission you do not hold; the API refuses it too. */
  grantable(id: string): boolean {
    return this.auth.can(id);
  }

  select(r: Role) {
    this.selectedId.set(r.id);
    this.draft.set({ id: r.id, name: r.name, description: r.description, permissions: new Set(r.permissions) });
  }

  startNew() {
    this.selectedId.set(null);
    this.draft.set({ id: null, name: '', description: '', permissions: new Set(['dashboards:read']) });
  }

  copy() {
    const d = this.draft();
    if (!d) return;
    this.selectedId.set(null);
    this.draft.set({
      id: null,
      name: this.t.instant('admin.roles.copyName', { name: d.name }),
      description: d.description,
      permissions: new Set([...d.permissions].filter((p) => this.grantable(p))),
    });
  }

  cancelNew() {
    const first = this.roles()[0];
    if (first) this.select(first);
  }

  toggle(id: string, on: boolean) {
    const d = this.draft();
    if (!d) return;
    const next = new Set(d.permissions);
    if (on) next.add(id);
    else next.delete(id);
    this.draft.set({ ...d, permissions: next });
  }

  private finish(message: string, selectId?: string) {
    this.busy.set(false);
    this.error.set('');
    this.notice.set(message);
    this.load(selectId);
  }

  private fail(e: unknown) {
    this.busy.set(false);
    this.notice.set('');
    this.error.set(errorText(e));
  }

  save() {
    const d = this.draft();
    if (!d) return;
    this.busy.set(true);
    const body = { name: d.name.trim(), description: d.description.trim(), permissions: [...d.permissions] };
    const req = d.id ? this.api.updateRole(d.id, body) : this.api.createRole(body);
    req.subscribe({
      next: (r) => {
        this.auth.reloadUser().subscribe();
        this.finish(this.t.instant('admin.roles.saved', { name: r.name }), r.id);
      },
      error: (e) => this.fail(e),
    });
  }

  remove() {
    const d = this.draft();
    if (!d?.id) return;
    if (!confirm(this.t.instant('admin.roles.confirmDelete', { name: d.name }))) return;
    this.busy.set(true);
    this.api.deleteRole(d.id).subscribe({
      next: () => {
        this.selectedId.set(null);
        this.finish(this.t.instant('admin.roles.deleted', { name: d.name }));
      },
      error: (e) => this.fail(e),
    });
  }
}
