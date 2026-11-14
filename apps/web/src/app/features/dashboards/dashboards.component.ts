/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { AdminApiService, type Role, errorText } from '../../core/services/admin-api.service';
import { DashboardsApiService, type DashboardItem, dashboardRoute } from '../../core/services/dashboards-api.service';
import { IconComponent } from '../../core/ui/icon.component';

@Component({
  selector: 'pvx-dashboards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TranslatePipe, IconComponent],
  template: `
    <div class="pvx-page">
      <header class="pvx-page-head">
        <div>
          <h1>{{ 'nav.dashboards' | translate }}</h1>
          <p>{{ 'dashboards.subtitle' | translate }}</p>
        </div>
        @if (canWrite()) {
          <div class="actions">
            <a class="pvx-btn" routerLink="/templates">{{ 'dashboard.tryTemplate' | translate }}</a>
            <button type="button" class="pvx-btn primary" (click)="creating.set(true)" [disabled]="creating()">
              <pvx-icon name="plus" [size]="18" />{{ 'dashboard.create' | translate }}</button>
          </div>
        }
      </header>

      @if (error()) { <p class="pvx-note error" role="alert">{{ error() }}</p> }

      @if (creating()) {
        <form class="pvx-panel create" (ngSubmit)="create()">
          <label class="pvx-field"><span>{{ 'dashboards.title' | translate }}</span>
            <input class="pvx-input" name="title" [(ngModel)]="newTitle" maxlength="120" required minlength="2" /></label>
          <fieldset>
            <legend>{{ 'dashboards.whoCanView' | translate }}</legend>
            <div class="roles">
              @for (r of roles(); track r.id) {
                <label class="pvx-check"><input type="checkbox" [checked]="newRoles.has(r.id)" (change)="toggle(r.id, $any($event.target).checked)" />
                  <span>{{ r.name }}</span></label>
              }
            </div>
            <small>{{ 'dashboards.whoHint' | translate }}</small>
          </fieldset>
          <div class="row">
            <button class="pvx-btn primary" type="submit" [disabled]="newTitle.trim().length < 2">{{ 'dashboards.createAndEdit' | translate }}</button>
            <button class="pvx-btn ghost" type="button" (click)="creating.set(false)">{{ 'common.cancel' | translate }}</button>
          </div>
        </form>
      }

      @if (loaded() && items().length === 0) {
        <div class="pvx-panel pvx-empty">
          <p>{{ (canWrite() ? 'dashboards.emptyWriter' : 'dashboards.emptyViewer') | translate }}</p>
        </div>
      } @else {
        <ul class="cards">
          @for (d of items(); track d.id) {
            <li class="pvx-panel card">
              <a [routerLink]="route(d)" class="title">{{ d.title }}</a>
              @if (d.description) { <p class="desc">{{ d.description }}</p> }
              <p class="meta">
                @if (d.template) { <span class="pvx-tag">{{ 'dashboards.template' | translate }}</span> }
                @else { <span class="pvx-num">{{ 'dashboards.panelCount' | translate: { count: d.config?.panels?.length ?? 0 } }}</span> }
                @if (canWrite() && d.roleIds && !d.template) {
                  <span>· {{ viewersLabel(d) }}</span>
                }
              </p>
              @if (homeName(d)) { <p class="home"><span class="pvx-tag brand">{{ homeName(d) }}</span></p> }
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .pvx-note { margin-bottom: 16px; }
    .create { padding: 16px 20px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 16px; }
    .create .pvx-field { max-width: 480px; }
    fieldset { border: 0; }
    legend { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
    .roles { display: flex; flex-wrap: wrap; gap: 10px 24px; margin-bottom: 6px; }
    small { font-size: 12px; color: var(--pvx-text-muted); }
    .row { display: flex; gap: 8px; }
    .cards { list-style: none; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .card { padding: 18px 20px; display: flex; flex-direction: column; gap: 6px; }
    .title { font-size: 16px; font-weight: 700; color: var(--pvx-text); text-decoration: none; }
    .title:hover { color: var(--pvx-link); text-decoration: underline; }
    .desc { font-size: 14px; color: var(--pvx-text-muted); }
    .meta { font-size: 13px; color: var(--pvx-text-muted); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: auto; }
  `],
})
export class DashboardsComponent implements OnInit {
  private readonly api = inject(DashboardsApiService);
  private readonly admin = inject(AdminApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly t = inject(TranslateService);

  readonly items = signal<DashboardItem[]>([]);
  readonly roles = signal<Role[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly creating = signal(false);
  readonly canWrite = computed(() => this.auth.can('dashboards:write'));
  newTitle = '';
  newRoles = new Set<string>();

  ngOnInit() {
    this.auth.ensureUser().subscribe((u) => {
      // Someone limited to one dashboard never sees this list.
      if (u?.locked && u.homeDashboardId) {
        this.router.navigate(['/d', u.homeDashboardId], { replaceUrl: true });
        return;
      }
      this.api.list().subscribe({
        next: (list) => {
          this.items.set(list);
          this.loaded.set(true);
        },
        error: (e) => {
          this.loaded.set(true);
          this.error.set(errorText(e));
        },
      });
      if (this.auth.can('roles:read')) {
        this.admin.roles().subscribe({
          next: (r) => {
            this.roles.set(r);
            const viewer = r.find((x) => x.key === 'viewer');
            if (viewer) this.newRoles.add(viewer.id);
          },
          error: () => undefined,
        });
      }
    });
  }

  route(d: DashboardItem) {
    return dashboardRoute(d);
  }

  toggle(id: string, on: boolean) {
    if (on) this.newRoles.add(id);
    else this.newRoles.delete(id);
  }

  viewersLabel(d: DashboardItem): string {
    const names = this.roles().filter((r) => d.roleIds?.includes(r.id)).map((r) => r.name);
    return names.length ? this.t.instant('dashboards.seenBy', { roles: names.join(', ') }) : this.t.instant('dashboards.editorsOnly');
  }

  /** "Home for Viewer" on cards that some role opens after sign-in. */
  homeName(d: DashboardItem): string {
    const names = this.roles().filter((r) => (r as Role & { homeDashboardId?: string | null }).homeDashboardId === d.id).map((r) => r.name);
    return names.length ? this.t.instant('dashboards.homeFor', { roles: names.join(', ') }) : '';
  }

  create() {
    this.api.create({ title: this.newTitle.trim(), roleIds: [...this.newRoles] }).subscribe({
      next: (d) => this.router.navigate(['/d', d.id], { queryParams: { edit: 1 } }),
      error: (e) => this.error.set(errorText(e)),
    });
  }
}
