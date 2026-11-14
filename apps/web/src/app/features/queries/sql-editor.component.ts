/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, inject, input, output, signal, viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { TableSchema } from '@paarvix/shared';
import { ThemeService } from '../../core/services/theme.service';
import { type MonacoApi, type MonacoEditor, loadMonaco } from './monaco-loader';

/** Monaco SQL editor with autocomplete from the selected source's tables and columns. Ctrl+Enter runs. */
@Component({
  selector: 'pvx-sql-editor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    @if (failed()) {
      <p class="pvx-note error" role="alert">{{ 'queries.editorFailed' | translate }}</p>
      <textarea class="fallback" [value]="value()" (input)="changed.emit($any($event.target).value)"
        [attr.aria-label]="'queries.sql' | translate" spellcheck="false"></textarea>
    } @else {
      @if (!ready()) { <p class="loading">{{ 'queries.editorLoading' | translate }}</p> }
      <div #host class="host" [class.hidden]="!ready()" role="textbox" aria-multiline="true" [attr.aria-label]="'queries.sql' | translate"></div>
    }
  `,
  styles: [`
    :host { display: block; border: 1px solid var(--pvx-border-strong); border-radius: var(--pvx-radius); overflow: hidden; background: var(--pvx-bg-card); }
    .host { height: 260px; }
    .host.hidden { visibility: hidden; height: 0; }
    .loading { padding: 16px; color: var(--pvx-text-muted); font-size: 14px; }
    .fallback { width: 100%; height: 240px; border: 0; padding: 12px; font: 14px/1.5 var(--pvx-font-code); background: var(--pvx-bg-card); color: var(--pvx-text); resize: vertical; }
    .pvx-note { margin: 8px; }
  `],
})
export class SqlEditorComponent implements AfterViewInit, OnDestroy {
  readonly value = input('');
  readonly schema = input<TableSchema[]>([]);
  readonly changed = output<string>();
  readonly run = output<void>();

  readonly ready = signal(false);
  readonly failed = signal(false);
  private readonly host = viewChild<ElementRef<HTMLElement>>('host');
  private readonly themeService = inject(ThemeService);
  private monaco: MonacoApi | null = null;
  private editor: MonacoEditor | null = null;
  private completion: { dispose(): void } | null = null;
  private resize: ResizeObserver | null = null;

  constructor() {
    effect(() => this.monaco?.editor.setTheme(this.themeService.theme() === 'dark' ? 'vs-dark' : 'vs'));
    effect(() => {
      const v = this.value();
      if (this.editor && this.editor.getValue() !== v) this.editor.setValue(v);
    });
    effect(() => this.registerCompletion(this.schema()));
  }

  async ngAfterViewInit() {
    try {
      this.monaco = await loadMonaco();
    } catch {
      this.failed.set(true);
      return;
    }
    const el = this.host()?.nativeElement;
    if (!el) return;
    this.editor = this.monaco.editor.create(el, {
      value: this.value(),
      language: 'sql',
      theme: this.themeService.theme() === 'dark' ? 'vs-dark' : 'vs',
      minimap: { enabled: false },
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 14,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: false,
      wordWrap: 'on',
      tabSize: 2,
      ariaLabel: 'SQL',
    });
    this.editor.onDidChangeModelContent(() => this.changed.emit(this.editor!.getValue()));
    this.editor.addCommand(this.monaco.KeyMod.CtrlCmd | this.monaco.KeyCode.Enter, () => this.run.emit());
    this.resize = new ResizeObserver(() => this.editor?.layout());
    this.resize.observe(el);
    this.registerCompletion(this.schema());
    this.ready.set(true);
  }

  /** Suggests the source's tables and columns, with the column type shown beside each. */
  private registerCompletion(schema: TableSchema[]) {
    if (!this.monaco) return;
    this.completion?.dispose();
    const kinds = this.monaco.languages.CompletionItemKind;
    this.completion = this.monaco.languages.registerCompletionItemProvider('sql', {
      provideCompletionItems: (model: { getWordUntilPosition(p: unknown): { startColumn: number; endColumn: number } }, position: { lineNumber: number }) => {
        const word = model.getWordUntilPosition(position);
        const range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: word.startColumn, endColumn: word.endColumn };
        const quote = (n: string) => (/^[a-z_][a-z0-9_]*$/.test(n) ? n : `"${n.replace(/"/g, '""')}"`);
        const suggestions = [
          ...schema.map((t) => ({ label: t.name, kind: kinds['Struct'], insertText: quote(t.name), detail: 'table', range })),
          ...schema.flatMap((t) => t.columns.map((c) => ({ label: c.name, kind: kinds['Field'], insertText: quote(c.name), detail: `${c.type} · ${t.name}`, range }))),
          ...['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'LIMIT', 'COUNT(*)', 'SUM', 'AVG', 'MIN', 'MAX', 'AS', 'AND', 'OR', 'DESC', 'ASC', 'WITH', 'JOIN', 'LEFT JOIN', 'ON']
            .map((k) => ({ label: k, kind: kinds['Keyword'], insertText: k, range })),
        ];
        return { suggestions };
      },
    });
  }

  ngOnDestroy() {
    this.resize?.disconnect();
    this.completion?.dispose();
    this.editor?.dispose();
  }
}
