/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ChangeDetectionStrategy, Component, ElementRef, OnInit, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { SourceFormComponent } from './source-form.component';
import { SourcePreviewComponent } from './source-preview.component';
import { fileProblem, sendForm, serverMessage } from './upload.util';

interface DatasourceItem {
  id: string;
  name: string;
  type: string;
  config: { host?: string; database?: string; lastSyncAt?: string; lastSyncError?: string; syncMinutes?: number };
}

interface RowNote {
  text: string;
  error: boolean;
}

@Component({
  selector: 'pvx-datasources',
  standalone: true,
  imports: [DatePipe, TranslatePipe, SourceFormComponent, SourcePreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pvx-page">
      <h2>{{ 'nav.datasources' | translate }}</h2>

      <div class="pvx-card">
        @if (loadError()) {
          <p class="pvx-error" role="alert">{{ loadError() }}</p>
        }
        @for (ds of sources(); track ds.id) {
          <div class="pvx-source">
            <div class="pvx-row">
              <span>
                <span class="pvx-badge">{{ 'datasources.type.' + ds.type | translate }}</span>
                <strong>{{ ds.name }}</strong>
                @if (ds.config.host) { <small> · {{ ds.config.host }}/{{ ds.config.database }}</small> }
              </span>
              <span class="pvx-actions">
                <button type="button" (click)="toggle(ds.id)" [attr.aria-expanded]="openId() === ds.id" [attr.aria-label]="('datasources.viewData' | translate) + ': ' + ds.name">
                  {{ 'datasources.viewData' | translate }}
                </button>
                @if (ds.type === 'gsheet') {
                  <button type="button" (click)="sync(ds.id)" [disabled]="busyId() === ds.id" [attr.aria-label]="('datasources.sync' | translate) + ': ' + ds.name">{{ 'datasources.sync' | translate }}</button>
                }
                @if (ds.type === 'excel') {
                  <button type="button" (click)="replace(ds.id)" [disabled]="busyId() === ds.id" [attr.aria-label]="('datasources.replaceFile' | translate) + ': ' + ds.name">{{ 'datasources.replaceFile' | translate }}</button>
                } @else {
                  <button type="button" (click)="test(ds.id)" [attr.aria-label]="('datasources.test' | translate) + ': ' + ds.name">{{ 'datasources.test' | translate }}</button>
                }
                <button type="button" (click)="remove(ds.id)" [attr.aria-label]="('datasources.remove' | translate) + ': ' + ds.name">{{ 'datasources.remove' | translate }}</button>
              </span>
            </div>

            @if (ds.type === 'gsheet') {
              <p class="pvx-meta">
                @if (ds.config.lastSyncAt) {
                  {{ 'datasources.lastSynced' | translate }}: {{ ds.config.lastSyncAt | date: 'dd-MM-yyyy HH:mm' }}
                } @else {
                  {{ 'datasources.neverSynced' | translate }}
                }
              </p>
              @if (ds.config.lastSyncError) {
                <p class="pvx-error" role="alert">{{ 'datasources.syncFailed' | translate }} {{ ds.config.lastSyncError }}</p>
              }
            }

            @if (notes()[ds.id]; as note) {
              <p [class.pvx-error]="note.error" role="status">{{ note.text }}</p>
            }
            @if (progressId() === ds.id) {
              <progress max="100" [value]="progress()" [attr.aria-label]="'datasources.uploading' | translate"></progress>
            }
            @if (openId() === ds.id) {
              <pvx-source-preview [sourceId]="ds.id" [kind]="ds.type" />
            }
          </div>
        } @empty {
          <p>{{ 'datasources.empty' | translate }}</p>
        }
      </div>

      <input #replaceInput type="file" accept=".xlsx" hidden (change)="replaced($event)" />

      <pvx-source-form (saved)="load()" />
    </div>
  `,
  styles: [`
    .pvx-page { max-width: 1200px; margin: 0 auto; }
    h2 { margin-bottom: 24px; }
    .pvx-card { padding: clamp(12px, 3vw, 24px); margin-bottom: 16px; background: var(--pvx-bg-card); border-radius: var(--pvx-radius); }
    .pvx-source { padding: 8px 0; border-bottom: 1px solid var(--pvx-border); }
    .pvx-source:last-child { border-bottom: 0; }
    .pvx-row { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: center; overflow-wrap: anywhere; }
    .pvx-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .pvx-actions button { min-height: 44px; padding: 0 12px; border: 1px solid var(--pvx-border); border-radius: var(--pvx-radius); background: transparent; color: inherit; cursor: pointer; }
    .pvx-actions button:disabled { opacity: 0.6; cursor: wait; }
    .pvx-badge { display: inline-block; margin-right: 8px; padding: 2px 8px; border-radius: 999px; background: var(--pvx-primary); color: #fff; font-size: 0.75rem; }
    .pvx-meta { color: var(--pvx-text-muted); font-size: 0.875rem; }
    .pvx-error { color: var(--pvx-danger); overflow-wrap: anywhere; }
    progress { width: 100%; }
  `],
})
export class DatasourcesComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(TranslateService);

  readonly sources = signal<DatasourceItem[]>([]);
  readonly notes = signal<Record<string, RowNote>>({});
  readonly openId = signal<string | null>(null);
  readonly busyId = signal<string | null>(null);
  readonly progressId = signal<string | null>(null);
  readonly progress = signal(0);
  readonly loadError = signal('');
  private replaceTarget: string | null = null;
  private readonly replaceInput = viewChild.required<ElementRef<HTMLInputElement>>('replaceInput');

  ngOnInit() {
    this.load();
  }

  load() {
    this.http.get<DatasourceItem[]>('/api/datasources').subscribe({
      next: (list) => {
        this.loadError.set('');
        this.sources.set(list);
      },
      error: (err) => this.loadError.set(serverMessage(err) ?? this.i18n.instant('datasources.errLoad')),
    });
  }

  toggle(id: string) {
    this.openId.update((cur) => (cur === id ? null : id));
  }

  test(id: string) {
    this.http.post<{ message: string }>(`/api/datasources/${id}/test`, {}).subscribe({
      next: (res) => this.note(id, res.message, false),
      error: (err) => this.note(id, serverMessage(err) ?? this.i18n.instant('datasources.errTest'), true),
    });
  }

  sync(id: string) {
    this.busyId.set(id);
    this.http.post(`/api/datasources/${id}/sync`, {}).subscribe({
      next: () => this.done(id, 'datasources.synced'),
      error: (err) => {
        this.busyId.set(null);
        this.note(id, serverMessage(err) ?? this.i18n.instant('datasources.errSync'), true);
        this.load(); // the server records lastSyncError
      },
    });
  }

  replace(id: string) {
    this.replaceTarget = id;
    this.replaceInput().nativeElement.click();
  }

  replaced(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const id = this.replaceTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!id || !file) return;
    const problem = fileProblem(file);
    if (problem) return this.note(id, this.i18n.instant(problem), true);
    const body = new FormData();
    body.append('file', file);
    this.busyId.set(id);
    this.progressId.set(id);
    this.progress.set(0);
    sendForm(this.http, `/api/datasources/${id}/upload`, body, (p) => this.progress.set(p)).subscribe({
      next: () => this.done(id, 'datasources.replaced'),
      error: (err) => {
        this.busyId.set(null);
        this.progressId.set(null);
        this.note(id, serverMessage(err) ?? this.i18n.instant('datasources.errSave'), true);
      },
    });
  }

  remove(id: string) {
    this.http.delete(`/api/datasources/${id}`).subscribe({
      next: () => this.load(),
      error: (err) => this.note(id, serverMessage(err) ?? this.i18n.instant('datasources.errRemove'), true),
    });
  }

  private done(id: string, key: string) {
    this.busyId.set(null);
    this.progressId.set(null);
    if (this.openId() === id) this.openId.set(null); // close the preview so it reloads fresh when reopened
    this.note(id, this.i18n.instant(key), false);
    this.load();
  }

  private note(id: string, text: string, error: boolean) {
    this.notes.update((n) => ({ ...n, [id]: { text, error } }));
  }
}
