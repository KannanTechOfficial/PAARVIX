/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'pvx-templates',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="pvx-page">
      <div class="pvx-page-header">
        <div>
          <h2>{{ 'nav.templates' | translate }}</h2>
          <p>Pre-built, domain-specific templates ready in &lt; 2 minutes.</p>
        </div>
      </div>

      @if (error()) {
        <p role="alert">{{ error() | translate }}</p>
      }

      <div class="pvx-grid">
        <!-- 1. College & Education Pack (Featured Beachhead) -->
        <div class="pvx-template-card featured">
          <div class="pvx-card-badge">⭐ FEATURED BEACHHEAD</div>
          <h3>🎓 College & Higher Education Pack</h3>
          <p>
            Full-featured academic ERP observability: Student portfolio, live biometric punch logs,
            semester grade cards, standing arrears, OD applications, and department analytics.
          </p>
          <div class="pvx-template-features">
            <span>✓ Student ID Card & Biometric Logs</span>
            <span>✓ Hour-wise Bio-Attendance Grid</span>
            <span>✓ Result & SGPA Analysis</span>
            <span>✓ Attendance Defaulters Radar (< 75%)</span>
            <span>✓ Continuous Internal Assessment Matrix</span>
          </div>
          <div class="pvx-template-actions">
            @if (applied().has('student-portfolio')) {
              <a routerLink="/dashboards/student-portfolio" class="pvx-btn-primary">
                🪪 Student Portfolio
              </a>
              <a routerLink="/dashboards/college-analytics" class="pvx-btn-secondary">
                🏫 College Analytics
              </a>
              <button class="pvx-btn-secondary" (click)="remove('college')">
                {{ 'templates.remove' | translate }}
              </button>
            } @else {
              @if (sources().length > 0) {
                <select [value]="selectedSource()" (change)="selectedSource.set($any($event.target).value)"
                  aria-label="Data source">
                  @for (ds of sources(); track ds.id) {
                    <option [value]="ds.id">{{ ds.name }}</option>
                  }
                </select>
                <button class="pvx-btn-primary" (click)="apply('college')">
                  {{ 'templates.apply' | translate }}
                </button>
              } @else {
                <a routerLink="/datasources" class="pvx-btn-primary">
                  {{ 'templates.connectFirst' | translate }}
                </a>
              }
            }
          </div>
        </div>

        <!-- 2. Healthcare Pack (Coming Soon) -->
        <div class="pvx-template-card">
          <div class="pvx-card-badge-muted">PHASE 3</div>
          <h3>🏥 Healthcare & Hospital</h3>
          <p>OPD/IPD patient flow, bed occupancy, pharmacy inventory, and lab turnaround times.</p>
          <div class="pvx-template-features">
            <span>✓ Real-time Bed Status</span>
            <span>✓ Doctor Consultation Queues</span>
            <span>✓ Pharmacy Stock Level Alerts</span>
          </div>
          <div class="pvx-template-actions">
            <button class="pvx-btn-disabled" disabled>Preview Available Soon</button>
          </div>
        </div>

        <!-- 3. Retail & SME Pack (Coming Soon) -->
        <div class="pvx-template-card">
          <div class="pvx-card-badge-muted">PHASE 3</div>
          <h3>🛒 Retail & SME Pack</h3>
          <p>Daily store sales, inventory valuation, GST summary, and repeat customer retention.</p>
          <div class="pvx-template-features">
            <span>✓ POS Terminal Integration</span>
            <span>✓ GST-Compliant Tax Summary</span>
            <span>✓ Fast-moving SKU Analytics</span>
          </div>
          <div class="pvx-template-actions">
            <button class="pvx-btn-disabled" disabled>Preview Available Soon</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pvx-page { max-width: 1200px; margin: 0 auto; padding-bottom: 48px; }
    .pvx-page-header { margin-bottom: 24px; }
    h2 { font-size: 24px; font-weight: 700; margin: 0; }
    p { color: var(--pvx-text-muted); margin: 4px 0 0 0; }
    .pvx-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 24px;
    }
    .pvx-template-card {
      padding: 24px;
      background: var(--pvx-bg-card);
      border-radius: var(--pvx-radius);
      border: 1px solid var(--pvx-border);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .pvx-template-card.featured {
      border-color: #14B8A6;
      box-shadow: 0 4px 20px rgba(20, 184, 166, 0.15);
    }
    .pvx-card-badge {
      display: inline-block;
      align-self: flex-start;
      background: rgba(20, 184, 166, 0.15);
      color: #0D9488;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .pvx-card-badge-muted {
      display: inline-block;
      align-self: flex-start;
      background: var(--pvx-bg);
      color: var(--pvx-text-muted);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 4px;
      margin-bottom: 12px;
    }
    .pvx-template-card h3 { margin: 0 0 8px 0; font-size: 18px; font-weight: 700; }
    .pvx-template-card p { color: var(--pvx-text-muted); font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
    .pvx-template-features {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 12px;
      color: var(--pvx-text);
      margin-bottom: 24px;
      background: var(--pvx-bg);
      padding: 12px;
      border-radius: 8px;
    }
    .pvx-template-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .pvx-btn-primary {
      padding: 8px 14px;
      background: var(--pvx-primary);
      color: #fff;
      border-radius: var(--pvx-radius);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
    }
    .pvx-btn-secondary {
      padding: 8px 14px;
      background: #14B8A6;
      color: #fff;
      border-radius: var(--pvx-radius);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
    }
    .pvx-btn-disabled {
      padding: 8px 14px;
      background: var(--pvx-bg);
      border: 1px solid var(--pvx-border);
      color: var(--pvx-text-muted);
      border-radius: var(--pvx-radius);
      font-size: 13px;
      cursor: not-allowed;
    }
  `],
})
export class TemplatesComponent implements OnInit {
  private readonly http = inject(HttpClient);

  /** Slugs of dashboards that exist, which tells us what is applied. */
  applied = signal<Set<string>>(new Set());
  error = signal('');
  sources = signal<{ id: string; name: string }[]>([]);
  selectedSource = signal('');

  ngOnInit() {
    this.refresh();
    this.http.get<{ id: string; name: string }[]>('/api/datasources').subscribe({
      next: (list) => {
        this.sources.set(list);
        this.selectedSource.set(list[0]?.id ?? '');
      },
    });
  }

  apply(key: string) {
    this.http
      .post(`/api/templates/${key}/apply`, { datasourceId: this.selectedSource() })
      .subscribe(this.handlers());
  }

  remove(key: string) {
    this.http.delete(`/api/templates/${key}`).subscribe(this.handlers());
  }

  private handlers() {
    return {
      next: () => this.refresh(),
      error: () => this.error.set('templates.failed'),
    };
  }

  private refresh() {
    this.error.set('');
    this.http.get<{ slug: string }[]>('/api/dashboards').subscribe({
      next: (list) => this.applied.set(new Set(list.map((d) => d.slug))),
    });
  }
}
