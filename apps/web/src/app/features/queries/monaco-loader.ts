/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- Monaco's AMD loader has no types on window */

/** The parts of Monaco this page uses. Kept small so the full typings are not needed in the bundle. */
export interface MonacoApi {
  editor: {
    create(el: HTMLElement, options: Record<string, unknown>): MonacoEditor;
    setTheme(name: string): void;
  };
  languages: {
    registerCompletionItemProvider(lang: string, provider: unknown): { dispose(): void };
    CompletionItemKind: Record<string, number>;
  };
  KeyMod: { CtrlCmd: number };
  KeyCode: { Enter: number };
}

export interface MonacoEditor {
  getValue(): string;
  setValue(v: string): void;
  onDidChangeModelContent(fn: () => void): { dispose(): void };
  addCommand(keybinding: number, handler: () => void): void;
  layout(): void;
  dispose(): void;
  focus(): void;
}

const BASE = '/assets/monaco/vs';
let loading: Promise<MonacoApi> | null = null;

/**
 * Loads Monaco from this server's own assets the first time the SQL editor opens.
 * Nothing comes from a CDN, so it works offline and on a campus network.
 */
export function loadMonaco(): Promise<MonacoApi> {
  if ((window as any).monaco?.editor) return Promise.resolve((window as any).monaco);
  loading ??= new Promise<MonacoApi>((resolve, reject) => {
    (window as any).MonacoEnvironment = {
      getWorkerUrl: () => `${BASE}/editor/editor.worker.js`,
    };
    const script = document.createElement('script');
    script.src = `${BASE}/loader.js`;
    script.onerror = () => {
      loading = null;
      reject(new Error('The SQL editor could not load'));
    };
    script.onload = () => {
      const req = (window as any).require;
      req.config({ paths: { vs: BASE } });
      req(['vs/editor/editor.main'], () => resolve((window as any).monaco), (e: unknown) => {
        loading = null;
        reject(e);
      });
    };
    document.head.appendChild(script);
  });
  return loading;
}
