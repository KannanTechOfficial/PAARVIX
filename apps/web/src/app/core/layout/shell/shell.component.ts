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
import { AppBarService } from '../../services/app-bar.service';

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
    @if (locked()) {
      <!-- Limited to one dashboard: no menu and nothing else to choose. -->
      <div class="pvx-locked">
        <header class="bar pvx-admin-area">
          <span class="brand">{{ theme.orgName() }}</span>
          <a class="who" routerLink="/account" [attr.title]="'account.title' | translate">{{ auth.user()?.name }}</a>
          <button class="bar-btn" type="button" (click)="theme.toggle()" [attr.aria-label]="(theme.theme() === 'dark' ? 'nav.light' : 'nav.dark') | translate">
            <pvx-icon [name]="theme.theme() === 'dark' ? 'sun' : 'moon'" [size]="18" /></button>
          <button class="bar-btn" type="button" (click)="auth.logout()"><pvx-icon name="logout" [size]="18" /><span>{{ 'nav.logout' | translate }}</span></button>
        </header>
        <main class="pvx-main"><router-outlet /></main>
      </div>
    } @else {
    <div class="pvx-shell" [class.collapsed]="collapsed() && !appMode()" [class.app-mode]="appMode()" [class.drawer-open]="drawer()">
      @if (appMode()) {
        <!-- Phone, on a dashboard: an app's top bar; the full menu slides in on request. -->
        <header class="appbar pvx-admin-area">
          <button type="button" class="bar-btn" (click)="drawer.set(true)" [attr.aria-label]="'nav.openMenu' | translate" [attr.aria-expanded]="drawer()">
            <pvx-icon name="menu" [size]="22" /></button>
          <span class="brand" [class.out]="appBar.showTitle()">{{ theme.orgName() }}</span>
          <span class="page-title" [class.in]="appBar.showTitle()" aria-hidden="true">{{ appBar.title() }}</span>
        </header>
        @if (drawer()) { <div class="scrim" (click)="drawer.set(false)" aria-hidden="true"></div> }
      }
      <aside class="pvx-sidebar pvx-admin-area" [attr.inert]="appMode() && !drawer() ? '' : null" (click)="appMode() && closeDrawerOnLink($event)">
        <div class="head">
          <img class="mark" src="icons/icon-192.png" alt="" width="28" height="28" />
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
            <!-- Opens the account page (signed-in devices). When the menu is narrow, the avatar alone is the link. -->
            <a class="me" routerLink="/account" routerLinkActive="active" [attr.title]="'account.title' | translate" [attr.aria-label]="'account.title' | translate">
              <span class="avatar" aria-hidden="true">{{ initials(u.name) }}</span>
              @if (!collapsed()) { <span class="who"><strong>{{ u.name }}</strong><span>{{ u.roleName }}</span></span> }
            </a>
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
    }
  `,
  styles: [`
    :host { display: block; }
    .pvx-shell { display: flex; min-height: 100vh; }
    .pvx-locked { min-height: 100vh; display: flex; flex-direction: column; }

    /* ---------- sidebar: quiet chrome, brand in the mark and the active item ---------- */
    .pvx-sidebar { width: 252px; flex-shrink: 0; background: var(--pvx-bg-sidebar); color: var(--pvx-sidebar-text);
      border-right: 1px solid var(--pvx-sidebar-border);
      display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh; overflow-y: auto; transition: width 220ms var(--pvx-ease); }
    .collapsed .pvx-sidebar { width: 68px; }
    .head { display: flex; align-items: center; gap: 10px; padding: 18px 12px 14px 18px; min-height: 64px; }
    .collapsed .head { padding: 18px 12px; justify-content: center; }
    .mark { width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; box-shadow: 0 1px 2px rgba(12,18,32,.15); }
    .collapsed .mark { display: none; }
    .brand { font: 600 17px var(--pvx-font-brand); letter-spacing: -0.01em; color: var(--pvx-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .icon-btn { margin-left: auto; display: inline-flex; padding: 7px; border: 0; border-radius: 8px; background: none; color: var(--pvx-sidebar-muted); cursor: pointer; }
    .collapsed .icon-btn { margin: 0; }
    .icon-btn:hover { background: var(--pvx-sidebar-hover); color: var(--pvx-text); }
    .nav { flex: 1; padding: 4px 12px; display: flex; flex-direction: column; gap: 2px; }
    .section { font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase; color: var(--pvx-sidebar-muted); padding: 20px 10px 8px; }
    .section:first-child { padding-top: 6px; }
    hr { border: 0; border-top: 1px solid var(--pvx-sidebar-border); margin: 10px 6px; }
    .item { display: flex; align-items: center; gap: 11px; min-height: 38px; padding: 0 10px; border-radius: 9px; border: 0; background: none;
      color: var(--pvx-sidebar-text); font: 500 14px var(--pvx-font-ui); letter-spacing: -0.005em; text-decoration: none; cursor: pointer;
      width: 100%; text-align: left; white-space: nowrap; transition: background-color 140ms ease-out, color 140ms ease-out; }
    .item pvx-icon { color: var(--pvx-sidebar-muted); transition: color 140ms ease-out; }
    .collapsed .item { justify-content: center; padding: 0; }
    .item:hover { background: var(--pvx-sidebar-hover); color: var(--pvx-text); text-decoration: none; }
    .item:hover pvx-icon { color: var(--pvx-text); }
    .item.active { background: var(--pvx-sidebar-active-bg); color: var(--pvx-sidebar-active-text); font-weight: 600; box-shadow: var(--pvx-sidebar-active-shadow); }
    .item.active pvx-icon { color: var(--pvx-sidebar-active-text); }
    .foot { padding: 12px; border-top: 1px solid var(--pvx-sidebar-border); display: flex; flex-direction: column; gap: 2px; }
    .me { display: flex; align-items: center; gap: 10px; padding: 6px 8px; margin-bottom: 6px; border-radius: var(--pvx-radius); color: inherit; text-decoration: none; transition: background 120ms ease-out; }
    .me:hover, .me.active { background: var(--pvx-sidebar-hover, rgba(127,127,127,.1)); text-decoration: none; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0; display: grid; place-items: center;
      background: var(--pvx-accent-gradient); color: #fff; font: 600 13px var(--pvx-font-ui); }
    .me .who { display: flex; flex-direction: column; min-width: 0; font-size: 14px; color: var(--pvx-text); font-weight: 600; }
    .me .who span { font-size: 12px; font-weight: 400; color: var(--pvx-sidebar-muted); }
    .me .who strong, .me .who span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pvx-main { flex: 1; min-width: 0; padding: clamp(16px, 3vw, 36px) clamp(16px, 3.2vw, 44px); }
    @media (max-width: 768px) { .pvx-sidebar { position: fixed; z-index: 20; } .pvx-main { margin-left: 68px; } .pvx-locked .pvx-main { margin-left: 0; } }

    /* ---------- frosted top bars (phone app mode, and the locked view) ---------- */
    .bar, .appbar { position: sticky; top: 0; z-index: 25; display: flex; align-items: center; gap: 10px;
      padding: calc(8px + env(safe-area-inset-top)) clamp(12px, 3vw, 32px) 8px;
      background: color-mix(in srgb, var(--pvx-bg) 78%, transparent);
      backdrop-filter: blur(18px) saturate(1.6); -webkit-backdrop-filter: blur(18px) saturate(1.6);
      border-bottom: 1px solid var(--pvx-border); color: var(--pvx-text); }
    .bar .brand { margin-right: auto; }
    .bar .who { font-size: 14px; color: var(--pvx-text-muted); text-decoration: none; }
    .bar .who:hover { color: var(--pvx-text); }
    .bar-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 0 10px; border: 0; border-radius: 10px; background: none;
      color: var(--pvx-text); font: 500 14px var(--pvx-font-ui); cursor: pointer; }
    .bar-btn:hover { background: var(--pvx-bg-sunken); }
    .bar-btn:active { transform: scale(.95); }
    @media (max-width: 480px) { .bar .who, .bar-btn span { display: none; } }

    .app-mode { flex-direction: column; }
    .app-mode .pvx-main { margin-left: 0; padding-top: 12px; }
    .app-mode .pvx-sidebar { position: fixed; left: 0; top: 0; z-index: 50; width: min(300px, 84vw); transform: translateX(-102%);
      transition: transform 280ms var(--pvx-ease); box-shadow: var(--pvx-shadow-lg); }
    .app-mode.drawer-open .pvx-sidebar { transform: none; }
    /* Closed: fully hidden, shadow included, so no edge of it shows on the page. */
    .app-mode:not(.drawer-open) .pvx-sidebar { box-shadow: none; visibility: hidden; transition: transform 280ms var(--pvx-ease), visibility 0s 280ms; }
    .appbar { overflow: hidden; padding-left: 8px; }
    .appbar .brand, .appbar .page-title { font: 600 17px var(--pvx-font-brand); color: var(--pvx-text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      transition: opacity 200ms ease-out, transform 260ms var(--pvx-ease); }
    .appbar .brand.out { opacity: 0; transform: translateY(-14px); }
    .appbar .page-title { position: absolute; left: 60px; right: 16px; opacity: 0; transform: translateY(14px); }
    .appbar .page-title.in { opacity: 1; transform: none; }
    .scrim { position: fixed; inset: 0; z-index: 45; background: rgba(6,8,13,.42); backdrop-filter: blur(2px); animation: fade 200ms ease-out; }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) {
      .app-mode .pvx-sidebar, .appbar .brand, .appbar .page-title, .pvx-sidebar { transition: none; }
      .scrim { animation: none; }
    }
  `],
})
export class ShellComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly theme = inject(ThemeService);
  readonly appBar = inject(AppBarService);
  private readonly api = inject(AdminApiService);
  private readonly router = inject(Router);

  readonly collapsed = signal(window.matchMedia('(max-width: 768px)').matches); // the full menu would fill a phone screen

  private readonly url = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.router.url)),
    { initialValue: this.router.url },
  );
  readonly locked = computed(() => !!this.auth.user()?.locked);
  private readonly narrow = signal(window.matchMedia('(max-width: 700px)').matches);
  /** A dashboard on a phone is shown as an app: no rail, a top bar and a drawer. */
  readonly appMode = computed(() => this.narrow() && this.url().startsWith('/d/'));
  readonly drawer = signal(false);
  readonly inAdmin = computed(() => ADMIN_PREFIXES.some((p) => this.url().startsWith(p)));

  /** Reading user() inside makes these recompute when the user loads. */
  readonly workspace = computed(() => (this.auth.user(), WORKSPACE.filter((i) => this.auth.can(i.permission))));
  readonly admin = computed(() => (this.auth.user(), ADMIN.filter((i) => this.auth.can(i.permission))));

  initials(name: string): string {
    return name.replace(/^Dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');
  }

  closeDrawerOnLink(e: Event) {
    if ((e.target as HTMLElement).closest('a')) this.drawer.set(false);
  }

  ngOnInit() {
    window.matchMedia('(max-width: 700px)').addEventListener('change', (e) => this.narrow.set(e.matches));
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
