/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { Injectable, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, from, of, switchMap, tap, throwError } from 'rxjs';
import { DashboardsApiService, type PanelResult } from './dashboards-api.service';

export interface PanelData extends PanelResult {
  /** True when the network failed and this is the last copy kept on the device. */
  offline?: boolean;
}

const CACHE = 'paarvix-panel-data';

/**
 * Loads a panel's data and keeps the last good copy on this device, so a dashboard still shows
 * something on a weak connection. The copy is removed on sign-out (see clearPanelCache).
 */
@Injectable({ providedIn: 'root' })
export class PanelDataService {
  private readonly api = inject(DashboardsApiService);

  private key(dashboardId: string, panelId: string, as: string | null) {
    return `/__paarvix/panel/${encodeURIComponent(dashboardId)}/${encodeURIComponent(panelId)}?as=${encodeURIComponent(as ?? '')}`;
  }

  load(dashboardId: string, panelId: string, as: string | null): Observable<PanelData> {
    const key = this.key(dashboardId, panelId, as);
    return this.api.panelData(dashboardId, panelId, as).pipe(
      tap((r) => void this.store(key, r)),
      catchError((e: unknown) => {
        // Only a network failure falls back; a refusal or a query error must be shown as it is.
        if (!(e instanceof HttpErrorResponse) || e.status !== 0) return throwError(() => e);
        return from(this.read(key)).pipe(switchMap((cached) => (cached ? of({ ...cached, offline: true }) : throwError(() => e))));
      }),
    );
  }

  private async store(key: string, r: PanelResult) {
    try {
      if (!('caches' in window)) return;
      const c = await caches.open(CACHE);
      await c.put(key, new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } }));
    } catch {
      /* storage full or blocked: the live view still works */
    }
  }

  private async read(key: string): Promise<PanelResult | null> {
    try {
      if (!('caches' in window)) return null;
      const res = await (await caches.open(CACHE)).match(key);
      return res ? ((await res.json()) as PanelResult) : null;
    } catch {
      return null;
    }
  }
}

/** Removes every kept panel result. Called on sign-out, so the next person on this device sees nothing. */
export async function clearPanelCache(): Promise<void> {
  try {
    if ('caches' in window) await caches.delete(CACHE);
  } catch {
    /* nothing kept */
  }
}
