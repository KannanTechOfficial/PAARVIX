/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { ChangeDetectionStrategy, Component, ElementRef, inject, output, signal, viewChild } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { fileProblem, sendForm, serverMessage } from './upload.util';

type Kind = 'excel' | 'gsheet' | 'mysql' | 'postgres';

const KINDS: Kind[] = ['excel', 'gsheet', 'mysql', 'postgres'];
const REQUIRED: Record<Kind, string[]> = {
  excel: ['name'],
  gsheet: ['name', 'link'],
  mysql: ['name', 'host', 'database', 'user'],
  postgres: ['name', 'host', 'database', 'user'],
};
// The server refuses anything under 15 minutes; 0 means "do not refresh by itself".
const SYNC_CHOICES = [0, 15, 30, 60, 360, 1440];

/** Chooser and form for adding a source. Secrets are never pre-filled and are cleared after saving. */
@Component({
  selector: 'pvx-source-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h3>{{ 'datasources.add' | translate }}</h3>

      <div class="kinds" role="group" [attr.aria-label]="'datasources.chooseType' | translate">
        @for (k of kinds; track k) {
          <button type="button" [attr.aria-pressed]="kind() === k" (click)="choose(k)">
            {{ 'datasources.type.' + k | translate }}
          </button>
        }
      </div>

      <label>{{ 'datasources.name' | translate }}
        <input formControlName="name" autocomplete="off" required /></label>

      @switch (kind()) {
        @case ('excel') {
          <label>{{ 'datasources.excelFile' | translate }}
            <input #fileInput type="file" accept=".xlsx" (change)="pick($event)" /></label>
          <p class="hint">{{ 'datasources.excelHint' | translate }}</p>
          <p class="hint">{{ 'datasources.headerNote' | translate }}</p>
        }
        @case ('gsheet') {
          <label>{{ 'datasources.sheetLink' | translate }}
            <input formControlName="link" type="url" autocomplete="off" required /></label>
          <p class="hint">{{ 'datasources.sheetHint' | translate }}</p>
          <label>{{ 'datasources.serviceKey' | translate }}
            <textarea formControlName="serviceAccount" rows="3" autocomplete="off" spellcheck="false"></textarea></label>
          <p class="hint">{{ 'datasources.serviceKeyHint' | translate }}</p>
          <label>{{ 'datasources.refresh' | translate }}
            <select formControlName="syncMinutes">
              @for (m of syncChoices; track m) {
                <option [ngValue]="m">{{ m === 0 ? ('datasources.refreshOff' | translate) : (m + ' ' + ('datasources.minutes' | translate)) }}</option>
              }
            </select></label>
          <p class="hint">{{ 'datasources.headerNote' | translate }}</p>
        }
        @default {
          <p class="hint">{{ 'datasources.readOnlyUser' | translate }}</p>
          <label>{{ 'datasources.host' | translate }}
            <input formControlName="host" autocomplete="off" required /></label>
          <label>{{ 'datasources.port' | translate }}
            <input formControlName="port" type="number" inputmode="numeric" /></label>
          <label>{{ 'datasources.database' | translate }}
            <input formControlName="database" autocomplete="off" required /></label>
          <label>{{ 'datasources.user' | translate }}
            <input formControlName="user" autocomplete="off" required /></label>
          <label>{{ 'datasources.password' | translate }}
            <input formControlName="password" type="password" autocomplete="new-password" /></label>
          <label class="check"><input formControlName="ssl" type="checkbox" /> {{ 'datasources.ssl' | translate }}</label>
        }
      }

      @if (progress() !== null) {
        <progress max="100" [value]="progress()" [attr.aria-label]="'datasources.uploading' | translate"></progress>
      }
      @if (error()) {
        <p class="err" role="alert">{{ error() }}</p>
      }
      <button type="submit" class="primary" [disabled]="busy()">{{ 'datasources.save' | translate }}</button>
    </form>
  `,
  styles: [`
    .card { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; max-width: 480px; padding: clamp(12px, 3vw, 24px); margin-bottom: 16px; background: var(--pvx-bg-card); border-radius: var(--pvx-radius); }
    label { display: grid; gap: 4px; }
    .check { display: flex; gap: 8px; align-items: center; }
    input:not([type='checkbox']), select, textarea { width: 100%; min-height: 44px; padding: 8px; border: 1px solid var(--pvx-border); border-radius: var(--pvx-radius); background: var(--pvx-bg); color: inherit; font: inherit; max-width: 100%; }
    .hint { color: var(--pvx-text-muted); font-size: 0.875rem; }
    .err { color: var(--pvx-danger); overflow-wrap: anywhere; }
    .kinds { display: flex; gap: 8px; flex-wrap: wrap; }
    button { min-height: 44px; padding: 0 16px; border: 1px solid var(--pvx-border); border-radius: var(--pvx-radius); background: transparent; color: inherit; cursor: pointer; }
    .kinds button[aria-pressed='true'], .primary { background: var(--pvx-primary); color: #fff; border-color: var(--pvx-primary); }
    button:disabled { opacity: 0.6; cursor: wait; }
    progress { width: 100%; }
  `],
})
export class SourceFormComponent {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly saved = output<void>();
  readonly kinds = KINDS;
  readonly syncChoices = SYNC_CHOICES;

  readonly kind = signal<Kind>('excel');
  readonly busy = signal(false);
  readonly progress = signal<number | null>(null);
  readonly error = signal('');
  private file: File | null = null;
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  readonly form = this.fb.group({
    name: [''],
    link: [''],
    serviceAccount: [''],
    syncMinutes: [0],
    host: [''],
    port: [3306 as number | null],
    database: [''],
    user: [''],
    password: [''],
    ssl: [false],
  });

  constructor() {
    this.choose('excel');
  }

  choose(k: Kind) {
    this.kind.set(k);
    this.error.set('');
    this.form.controls.password.reset();
    this.form.controls.serviceAccount.reset();
    if (k === 'mysql' || k === 'postgres') this.form.controls.port.setValue(k === 'mysql' ? 3306 : 5432);
    for (const [key, ctl] of Object.entries(this.form.controls)) {
      if (REQUIRED[k].includes(key)) ctl.addValidators(Validators.required);
      else ctl.removeValidators(Validators.required);
      ctl.updateValueAndValidity({ emitEvent: false });
    }
  }

  pick(ev: Event) {
    const f = (ev.target as HTMLInputElement).files?.[0] ?? null;
    const problem = f ? fileProblem(f) : null;
    this.file = problem ? null : f;
    this.error.set(problem ? this.i18n.instant(problem) : '');
    if (problem) (ev.target as HTMLInputElement).value = '';
  }

  submit() {
    this.error.set('');
    const k = this.kind();
    if (this.form.invalid || (k === 'excel' && !this.file)) {
      this.form.markAllAsTouched();
      this.error.set(this.i18n.instant(k === 'excel' && !this.file ? 'datasources.errNoFile' : 'datasources.errRequired'));
      return;
    }
    const v = this.form.getRawValue();
    this.busy.set(true);
    let request;
    if (k === 'excel') {
      const body = new FormData();
      body.append('name', v.name);
      body.append('file', this.file as File);
      this.progress.set(0);
      request = sendForm(this.http, '/api/datasources/upload', body, (p) => this.progress.set(p));
    } else {
      const config =
        k === 'gsheet'
          ? {
              link: v.link.trim(),
              ...(v.serviceAccount.trim() && { serviceAccount: v.serviceAccount.trim() }),
              ...(v.syncMinutes > 0 && { syncMinutes: v.syncMinutes }),
            }
          : { host: v.host, port: v.port ?? undefined, database: v.database, user: v.user, password: v.password, ssl: v.ssl };
      request = this.http.post('/api/datasources', { name: v.name, type: k, config });
    }
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.progress.set(null);
        this.file = null;
        const input = this.fileInput();
        if (input) input.nativeElement.value = '';
        this.form.reset(); // clears password and key too
        this.choose(k);
        this.saved.emit();
      },
      error: (err) => {
        this.busy.set(false);
        this.progress.set(null);
        this.error.set(serverMessage(err) ?? this.i18n.instant('datasources.errSave'));
      },
    });
  }
}
