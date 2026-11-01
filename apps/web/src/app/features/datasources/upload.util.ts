/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

import { HttpClient, HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Observable, filter, map, tap } from 'rxjs';

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Returns a translation key describing why the file is refused, or null when it is fine. The server checks again. */
export function fileProblem(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) return 'datasources.errNotXlsx';
  if (file.size > MAX_UPLOAD_BYTES) return 'datasources.errTooBig';
  return null;
}

/** Posts a multipart form and reports 0-100 progress. Emits the response body once done. */
export function sendForm<T>(
  http: HttpClient,
  url: string,
  body: FormData,
  onProgress: (percent: number) => void,
): Observable<T> {
  return http.post<T>(url, body, { reportProgress: true, observe: 'events' }).pipe(
    tap((e) => {
      if (e.type === HttpEventType.UploadProgress && e.total) {
        onProgress(Math.round((100 * e.loaded) / e.total));
      }
    }),
    filter((e) => e.type === HttpEventType.Response),
    map((e) => (e as { body: T }).body),
  );
}

/** The server's own plain-words message, if it sent one. */
export function serverMessage(err: unknown): string | null {
  const m = (err as HttpErrorResponse)?.error?.message;
  if (Array.isArray(m)) return m.filter((x) => typeof x === 'string').join(' ') || null;
  return typeof m === 'string' && m ? m : null;
}
