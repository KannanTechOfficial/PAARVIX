/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe } from '@ngx-translate/core';

interface DashboardItem {
  id: string;
  title: string;
  description?: string;
  slug: string;
  isPublic: boolean;
  category: string;
  tags: string[];
  updatedAt: string;
  creatorName: string;
  route: string;
}

@Component({
  selector: 'pvx-dashboards',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  template: `
    <div class="pvx-page">
      <div class="pvx-page-header">
        <div>
          <h2>{{ 'nav.dashboards' | translate }}</h2>
          <p>{{ 'app.tagline' | translate }}</p>
        </div>
        <div class="pvx-header-actions">
          <a routerLink="/templates" class="pvx-btn-secondary">
            📋 {{ 'dashboard.tryTemplate' | translate }}
          </a>
          <button class="pvx-btn-primary" (click)="onCreateNew()">
            + {{ 'dashboard.create' | translate }}
          </button>
        </div>
      </div>

      <!-- Category Filter Tabs -->
      <div class="pvx-filter-bar">
        <button
          [class.active]="selectedCategory() === 'ALL'"
          (click)="onSelectCat('ALL')">
          All Dashboards
        </button>
        <button
          [class.active]="selectedCategory() === 'Education'"
          (click)="onSelectCat('Education')">
          🎓 College & Education
        </button>
      </div>

      @if (dashboards().length === 0) {
        <div class="pvx-empty-state">
          <h3>{{ 'dashboard.emptyTitle' | translate }}</h3>
          <p>{{ 'dashboard.emptyHint' | translate }}</p>
          <a routerLink="/templates" class="pvx-btn-primary">
            📋 {{ 'dashboard.tryTemplate' | translate }}
          </a>
        </div>
      }

      <!-- Dashboards Grid -->
      <div class="pvx-dashboards-grid">
        @for (d of filteredDashboards(); track d.id) {
          <div class="pvx-dash-card">
            <div class="pvx-dash-card-header">
              <span class="pvx-category-tag">
                {{ d.category === 'Education' ? '🎓' : '⚡' }} {{ d.category }}
              </span>
              <span class="pvx-live-badge">● LIVE</span>
            </div>

            <div class="pvx-dash-card-body">
              <h3>
                <a [routerLink]="d.route" class="pvx-dash-title-link">{{ d.title }}</a>
              </h3>
              <p class="pvx-dash-desc">{{ d.description }}</p>

              <div class="pvx-tags-list">
                @for (tag of d.tags; track tag) {
                  <span class="pvx-tag-item">#{{ tag }}</span>
                }
              </div>
            </div>

            <div class="pvx-dash-card-footer">
              <div class="pvx-dash-meta">
                <span>By <strong>{{ d.creatorName }}</strong></span>
                <span class="pvx-dot">•</span>
                <span>{{ d.category }}</span>
              </div>
              <a [routerLink]="d.route" class="pvx-btn-open">
                Open ➔
              </a>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .pvx-page {
      max-width: 1200px;
      margin: 0 auto;
      padding-bottom: 48px;
    }
    .pvx-empty-state {
      text-align: center;
      padding: 64px 16px;
      border: 1px dashed var(--pvx-border, currentColor);
      border-radius: 12px;
    }
    .pvx-empty-state h3 { margin: 0 0 8px 0; }
    .pvx-empty-state p { margin: 0 0 20px 0; }
    .pvx-empty-state a { display: inline-block; text-decoration: none; }
    .pvx-page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 16px;
    }
    h2 { font-size: 24px; font-weight: 700; margin: 0; }
    p { color: var(--pvx-text-muted); margin: 4px 0 0 0; }
    .pvx-header-actions { display: flex; gap: 12px; }
    .pvx-btn-primary {
      padding: 10px 18px;
      background: var(--pvx-primary);
      color: #fff;
      border: none;
      border-radius: var(--pvx-radius);
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }
    .pvx-btn-secondary {
      padding: 10px 18px;
      background: var(--pvx-bg-card);
      border: 1px solid var(--pvx-border);
      color: var(--pvx-text);
      border-radius: var(--pvx-radius);
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
    }

    /* Filter Bar */
    .pvx-filter-bar {
      display: flex;
      gap: 10px;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--pvx-border);
      padding-bottom: 12px;
    }
    .pvx-filter-bar button {
      padding: 8px 16px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 20px;
      color: var(--pvx-text-muted);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    .pvx-filter-bar button:hover {
      background: var(--pvx-bg-card);
      color: var(--pvx-text);
    }
    .pvx-filter-bar button.active {
      background: var(--pvx-primary);
      color: #fff;
    }

    /* Dashboards Grid */
    .pvx-dashboards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 24px;
    }
    .pvx-dash-card {
      background: var(--pvx-bg-card);
      border: 1px solid var(--pvx-border);
      border-radius: 12px;
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, box-shadow 0.2s;
      box-shadow: var(--pvx-shadow);
    }
    .pvx-dash-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
      border-color: #14B8A6;
    }
    .pvx-dash-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 14px;
    }
    .pvx-category-tag {
      font-size: 11px;
      font-weight: 700;
      color: var(--pvx-primary);
      background: rgba(30, 58, 138, 0.08);
      padding: 3px 8px;
      border-radius: 4px;
    }
    .pvx-live-badge {
      font-size: 11px;
      font-weight: 700;
      color: #16A34A;
      background: rgba(34, 197, 94, 0.12);
      padding: 3px 8px;
      border-radius: 12px;
    }
    .pvx-dash-card-body h3 {
      font-size: 18px;
      font-weight: 700;
      margin: 0 0 8px 0;
    }
    .pvx-dash-title-link {
      color: var(--pvx-text);
      text-decoration: none;
    }
    .pvx-dash-title-link:hover {
      color: var(--pvx-primary);
    }
    .pvx-dash-desc {
      font-size: 13px;
      color: var(--pvx-text-muted);
      line-height: 1.5;
      margin: 0 0 16px 0;
      min-height: 40px;
    }
    .pvx-tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 20px;
    }
    .pvx-tag-item {
      font-size: 11px;
      color: var(--pvx-text-muted);
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .pvx-dash-card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 16px;
      border-top: 1px solid var(--pvx-border);
    }
    .pvx-dash-meta {
      font-size: 12px;
      color: var(--pvx-text-muted);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pvx-dot { color: var(--pvx-border); }
    .pvx-btn-open {
      padding: 6px 14px;
      background: #14B8A6;
      color: #fff;
      text-decoration: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
      transition: opacity 0.2s;
    }
    .pvx-btn-open:hover { opacity: 0.9; }
  `],
})
export class DashboardsComponent implements OnInit {
  private readonly http = inject(HttpClient);

  selectedCategory = signal<string>('ALL');
  dashboards = signal<DashboardItem[]>([]);

  filteredDashboards = signal<DashboardItem[]>([]);

  ngOnInit() {
    this.http.get<any[]>('/api/dashboards').subscribe({
      next: (list) => {
        if (list) {
          const apiItems: DashboardItem[] = list.map((item) => ({
            id: item.id,
            title: item.title,
            description: item.description,
            slug: item.slug,
            isPublic: item.isPublic,
            category: item.config?.category || 'Education',
            tags: item.config?.tags || ['Analytics'],
            updatedAt: 'Today',
            creatorName: item.creator?.name || 'Admin',
            route:
              item.slug === 'student-portfolio'
                ? '/dashboards/student-portfolio'
                : item.slug === 'college-analytics'
                ? '/dashboards/college-analytics'
                : `/dashboards/${item.id}`,
          }));

          this.dashboards.set(apiItems);
          this.updateFiltered();
        }
      },
    });
  }

  onSelectCat(cat: string) {
    this.selectedCategory.set(cat);
    this.updateFiltered();
  }

  updateFiltered() {
    const cat = this.selectedCategory();
    if (cat === 'ALL') {
      this.filteredDashboards.set(this.dashboards());
    } else {
      this.filteredDashboards.set(this.dashboards().filter((d) => d.category === cat));
    }
  }

  onCreateNew() {
    alert('Create Custom Dashboard modal will open in builder mode.');
  }
}
