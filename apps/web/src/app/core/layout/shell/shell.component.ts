/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Component, signal, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'pvx-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  template: `
    <div class="pvx-shell" [class.sidebar-collapsed]="sidebarCollapsed()">
      <aside class="pvx-sidebar">
        <div class="pvx-sidebar-header">
          <span class="pvx-logo">🔭</span>
          @if (!sidebarCollapsed()) {
            <span class="pvx-brand">Paarvix</span>
          }
          <button class="pvx-sidebar-toggle" (click)="toggleSidebar()">☰</button>
        </div>
        <nav class="pvx-nav">
          <a routerLink="/dashboards" routerLinkActive="active" class="pvx-nav-item">
            <span class="pvx-nav-icon">📊</span>
            @if (!sidebarCollapsed()) {
              <span>{{ 'nav.dashboards' | translate }}</span>
            }
          </a>
          <a routerLink="/datasources" routerLinkActive="active" class="pvx-nav-item">
            <span class="pvx-nav-icon">🔌</span>
            @if (!sidebarCollapsed()) {
              <span>{{ 'nav.datasources' | translate }}</span>
            }
          </a>
          <a routerLink="/queries" routerLinkActive="active" class="pvx-nav-item">
            <span class="pvx-nav-icon">🔍</span>
            @if (!sidebarCollapsed()) {
              <span>{{ 'nav.queries' | translate }}</span>
            }
          </a>
          <a routerLink="/templates" routerLinkActive="active" class="pvx-nav-item">
            <span class="pvx-nav-icon">📋</span>
            @if (!sidebarCollapsed()) {
              <span>{{ 'nav.templates' | translate }}</span>
            }
          </a>
          <a routerLink="/settings" routerLinkActive="active" class="pvx-nav-item">
            <span class="pvx-nav-icon">⚙️</span>
            @if (!sidebarCollapsed()) {
              <span>{{ 'nav.settings' | translate }}</span>
            }
          </a>
        </nav>
        <div class="pvx-sidebar-footer">
          <button class="pvx-nav-item" (click)="themeService.toggle()">
            <span class="pvx-nav-icon">{{ themeService.theme() === 'dark' ? '☀️' : '🌙' }}</span>
            @if (!sidebarCollapsed()) {
              <span>{{ themeService.theme() === 'dark' ? 'Light' : 'Dark' }}</span>
            }
          </button>
          <button class="pvx-nav-item" (click)="authService.logout()">
            <span class="pvx-nav-icon">🚪</span>
            @if (!sidebarCollapsed()) {
              <span>{{ 'nav.logout' | translate }}</span>
            }
          </button>
        </div>
      </aside>

      <main class="pvx-main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .pvx-shell {
      display: flex;
      min-height: 100vh;
    }

    .pvx-sidebar {
      width: 240px;
      background: var(--pvx-bg-sidebar);
      color: #fff;
      display: flex;
      flex-direction: column;
      transition: width 250ms ease;
      overflow: hidden;
    }

    .sidebar-collapsed .pvx-sidebar {
      width: 64px;
    }

    .sidebar-collapsed .pvx-logo {
      display: none;
    }

    .pvx-sidebar-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .pvx-logo {
      font-size: 24px;
    }

    .pvx-brand {
      font-family: 'Poppins', sans-serif;
      font-weight: 600;
      font-size: 18px;
      white-space: nowrap;
    }

    .pvx-sidebar-toggle {
      margin-left: auto;
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 18px;
      padding: 4px;
      border-radius: 4px;
      &:hover { background: rgba(255, 255, 255, 0.1); }
    }

    .pvx-nav {
      flex: 1;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .pvx-nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      color: rgba(255, 255, 255, 0.7);
      text-decoration: none;
      transition: all 150ms ease;
      cursor: pointer;
      border: none;
      background: none;
      font-size: 14px;
      width: 100%;
      text-align: left;
      white-space: nowrap;

      &:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
      &.active { background: rgba(255, 255, 255, 0.15); color: #fff; }
    }

    .pvx-nav-icon {
      font-size: 18px;
      flex-shrink: 0;
      width: 24px;
      text-align: center;
    }

    .pvx-sidebar-footer {
      padding: 8px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .pvx-main {
      flex: 1;
      min-width: 0;
      padding: clamp(12px, 3vw, 24px);
      overflow-y: auto;
    }
  `],
})
export class ShellComponent {
  sidebarCollapsed = signal(window.matchMedia('(max-width: 768px)').matches); // the full menu would fill a phone screen
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);

  toggleSidebar() {
    this.sidebarCollapsed.update((v) => !v);
  }
}
