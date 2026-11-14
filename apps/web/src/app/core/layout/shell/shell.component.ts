/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter, map } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { AdminApiService } from '../../services/admin-api.service';
import { IconComponent } from '../../ui/icon.component';

interface NavItem { path: string; label: string; icon: string; permission: string }

const WORKSPACE: NavItem[] = [
  { path: '/dashboards', label: 'nav.dashboards', icon: 'dashboards', permission: 'dashboards:read' },
  { path: '/queries', label: 'nav.queries', icon: 'queries', permission: 'datasources:query' },
  { path: '/templates', label: 'nav.templates', icon: 'templates', permission: 'templates:apply' },
];

const ADMIN: NavItem[] = [
  { path: '/datasources', label: 'nav.datasources', icon: 'datasources', permission: 'datasources:read' },
  { path: '/admin/users', label: 'nav.users', icon: 'users', permission: 'users:read' },
  { path: '/admin/roles', label: 'nav.roles', icon: 'roles', permission: 'roles:read' },
  { path: '/admin/access', label: 'nav.access', icon: 'access', permission: 'datasources:access' },
  { path: '/admin/plugins', label: 'nav.plugins', icon: 'plugins', permission: 'plugins:read' },
  { path: '/admin/settings', label: 'nav.settings', icon: 'settings', permission: 'settings:write' },
];

/** Routes drawn in the default design whatever the theme, so admins can always repair it. */
const ADMIN_PREFIXES = ['/admin', '/datasources'];

@Component({
  selector: 'pvx-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, IconComponent],
  template: `
    <div class="pvx-shell" [class.collapsed]="collapsed()">
      <aside class="pvx-sidebar pvx-admin-area">
        <div class="head">
          @if (!collapsed()) { <span class="brand">{{ theme.orgName() }}</span> }
          <button class="icon-btn" type="button" (click)="collapsed.set(!collapsed())"
            [attr.aria-label]="(collapsed() ? 'nav.expand' : 'nav.collapse') | translate" [attr.aria-expanded]="!collapsed()">
            <pvx-icon name="menu" />
          </button>
        </div>

        <nav class="nav" [attr.aria-label]="'nav.main' | translate">
          @if (workspace().length) {
            @if (!collapsed()) { <h2 class="section">{{ 'nav.workspace' | translate }}</h2> }
            @for (item of workspace(); track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" class="item" [attr.title]="collapsed() ? (item.label | translate) : null">
                <pvx-icon [name]="item.icon" />
                @if (!collapsed()) { <span>{{ item.label | translate }}</span> }
              </a>
            }
          }
          @if (admin().length) {
            @if (!collapsed()) { <h2 class="section">{{ 'nav.administration' | translate }}</h2> } @else { <hr /> }
            @for (item of admin(); track item.path) {
              <a [routerLink]="item.path" routerLinkActive="active" class="item" [attr.title]="collapsed() ? (item.label | translate) : null">
                <pvx-icon [name]="item.icon" />
                @if (!collapsed()) { <span>{{ item.label | translate }}</span> }
              </a>
            }
          }
        </nav>

        <div class="foot">
          @if (auth.user(); as u) {
            @if (!collapsed()) {
              <div class="me"><strong>{{ u.name }}</strong><span>{{ u.roleName }}</span></div>
            }
          }
          <button class="item" type="button" (click)="theme.toggle()" [attr.title]="collapsed() ? ((theme.theme() === 'dark' ? 'nav.light' : 'nav.dark') | translate) : null">
            <pvx-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" />
            @if (!collapsed()) { <span>{{ (theme.theme() === 'dark' ? 'nav.light' : 'nav.dark') | translate }}</span> }
          </button>
          <button class="item" type="button" (click)="auth.logout()" [attr.title]="collapsed() ? ('nav.logout' | translate) : null">
            <pvx-icon name="logout" />
            @if (!collapsed()) { <span>{{ 'nav.logout' | translate }}</span> }
          </button>
        </div>
      </aside>

      <main class="pvx-main" [class.pvx-admin-area]="inAdmin()">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .pvx-shell { display: flex; min-height: 100vh; }
    .pvx-sidebar { width: 248px; flex-shrink: 0; background: var(--pvx-bg-sidebar); color: var(--pvx-sidebar-text);
      display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; transition: width 200ms cubic-bezier(.2,.8,.2,1); }
    .collapsed .pvx-sidebar { width: 68px; }
    .head { display: flex; align-items: center; gap: 8px; padding: 16px 12px 16px 20px; min-height: 64px; }
    .collapsed .head { padding: 16px 12px; justify-content: center; }
    .brand { font: 600 19px var(--pvx-font-brand); color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .icon-btn { margin-left: auto; display: inline-flex; padding: 8px; border: 0; border-radius: 8px; background: none; color: var(--pvx-sidebar-text); cursor: pointer; }
    .collapsed .icon-btn { margin: 0; }
    .icon-btn:hover { background: var(--pvx-sidebar-hover); color: #fff; }
    .nav { flex: 1; padding: 4px 10px; display: flex; flex-direction: column; gap: 2px; }
    .section { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--pvx-sidebar-muted); padding: 18px 10px 6px; }
    .section:first-child { padding-top: 4px; }
    hr { border: 0; border-top: 1px solid rgba(255,255,255,.14); margin: 10px 6px; }
    .item { display: flex; align-items: center; gap: 12px; min-height: 40px; padding: 0 10px; border-radius: 8px; border: 0; background: none;
      color: var(--pvx-sidebar-text); font: 500 14px var(--pvx-font-ui); text-decoration: none; cursor: pointer; width: 100%; text-align: left; white-space: nowrap; }
    .collapsed .item { justify-content: center; padding: 0; }
    .item:hover { background: var(--pvx-sidebar-hover); color: #fff; text-decoration: none; }
    .item.active { background: #fff; color: var(--pvx-brand-primary); font-weight: 600; }
    .item:focus-visible { outline-color: #fdba74; }
    .foot { padding: 10px; border-top: 1px solid rgba(255,255,255,.14); display: flex; flex-direction: column; gap: 2px; }
    .me { display: flex; flex-direction: column; padding: 6px 10px 10px; font-size: 14px; color: #fff; }
    .me span { font-size: 12px; color: var(--pvx-sidebar-muted); }
    .pvx-main { flex: 1; min-width: 0; padding: clamp(16px, 3vw, 32px); }
    @media (max-width: 768px) { .pvx-sidebar { position: fixed; z-index: 20; } .pvx-main { margin-left: 68px; } }
  `],
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  readonly collapsed = signal(window.matchMedia('(max-width: 768px)').matches); // the full menu would fill a phone screen

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  readonly inAdmin = computed(() => ADMIN_PREFIXES.some((p) => this.url().startsWith(p)));

  /** Reading user() inside makes these recompute when the user loads. */
  readonly workspace = computed(() => (this.auth.user(), WORKSPACE.filter((i) => this.auth.can(i.permission))));
  readonly admin = computed(() => (this.auth.user(), ADMIN.filter((i) => this.auth.can(i.permission))));

  ngOnInit() {
    this.auth.ensureUser().subscribe();
    this.api.settings().subscribe({
      next: (s) => {
        this.theme.orgName.set(s.org.name);
        this.theme.applyTokens(s.theme);
      },
      error: () => undefined, // the default design stays in place
    });
  }
}
