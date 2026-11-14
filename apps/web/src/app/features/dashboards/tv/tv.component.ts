/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { type DashboardPanel, byReadingOrder, upgradeDashboardConfig } from '@paarvix/shared';
import { errorText } from '../../../core/services/admin-api.service';
import { DashboardsApiService, type DashboardItem } from '../../../core/services/dashboards-api.service';
import type { PanelData } from '../../../core/services/panel-data.service';
import { ThemeService } from '../../../core/services/theme.service';
import { clockTime } from '../../../core/charts/format';
import { IconComponent } from '../../../core/ui/icon.component';
import { ViewerPanelComponent } from '../viewer/viewer-panel.component';

interface Screen { title: string; headlines: DashboardPanel[]; charts: DashboardPanel[]; detail: DashboardPanel | null }

const REFRESH_MS = 60_000;

/**
 * A wallboard: one section per screen, rotating, readable from across a room.
 * Text is never smaller than 28px at 1080p, the usual floor for screens viewed from about three metres.
 */
@Component({
  selector: 'pvx-tv',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, RouterLink, IconComponent, ViewerPanelComponent],
  templateUrl: './tv.component.html',
  styleUrl: './tv.component.scss',
  host: { '[class.idle]': 'idle()' },
})
export class TvComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(DashboardsApiService);
  readonly theme = inject(ThemeService);

  readonly dashboard = signal<DashboardItem | null>(null);
  readonly error = signal('');
  readonly index = signal(0);
  readonly now = signal(new Date());
  readonly refreshKey = signal(0);
  readonly idle = signal(false);
  readonly lastData = signal<Date | null>(null);
  readonly offline = signal(false);
  readonly everyMs = signal(30_000);
  readonly progress = signal(0);

  private timers: ReturnType<typeof setInterval>[] = [];
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private wake: { release(): Promise<void> } | null = null;
  private screenStarted = Date.now();

  /** Each section becomes one screen: up to four headlines, up to two charts, or one short table. */
  readonly screens = computed<Screen[]>(() => {
    const cfg = upgradeDashboardConfig(this.dashboard()?.config);
    return cfg.sections
      .map((s) => {
        const own = cfg.panels.filter((p) => p.section === s.id).sort(byReadingOrder);
        const charts = [...own.filter((p) => p.role === 'story'), ...own.filter((p) => p.role === 'supporting')].slice(0, 2);
        return {
          title: s.title,
          headlines: own.filter((p) => p.role === 'headline').slice(0, 4),
          charts,
          detail: charts.length < 2 ? own.find((p) => p.role === 'detail') ?? null : null,
        };
      })
      .filter((s) => s.headlines.length || s.charts.length || s.detail);
  });
  readonly screen = computed(() => this.screens()[this.index() % Math.max(1, this.screens().length)] ?? null);
  readonly clock = computed(() => clockTime(this.now()));
  readonly dataTime = computed(() => (this.lastData() ? clockTime(this.lastData()!) : ''));
  /** Older than two refresh cycles: the room should know the numbers are not live. */
  readonly stale = computed(() => this.offline() || (!!this.lastData() && this.now().getTime() - this.lastData()!.getTime() > REFRESH_MS * 2.5));

  ngOnInit() {
    const every = Number(this.route.snapshot.queryParamMap.get('every'));
    if (Number.isFinite(every) && every >= 10) this.everyMs.set(Math.min(every, 600) * 1000);
    const id = this.route.snapshot.paramMap.get('id')!;
    this.api.get(id).subscribe({
      next: (d) => this.dashboard.set(d),
      error: (e) => this.error.set(errorText(e)),
    });
    this.timers.push(setInterval(() => this.now.set(new Date()), 1000));
    this.timers.push(setInterval(() => this.refreshKey.update((k) => k + 1), REFRESH_MS));
    this.timers.push(setInterval(() => this.tick(), 250));
    void this.keepAwake();
    document.addEventListener('visibilitychange', this.onVisible);
    this.wakeUp();
  }

  ngOnDestroy() {
    this.timers.forEach(clearInterval);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    document.removeEventListener('visibilitychange', this.onVisible);
    void this.wake?.release().catch(() => undefined);
  }

  private tick() {
    const n = this.screens().length;
    const elapsed = Date.now() - this.screenStarted;
    this.progress.set(n > 1 ? Math.min(1, elapsed / this.everyMs()) : 0);
    if (n > 1 && elapsed >= this.everyMs()) this.go(1);
  }

  go(step: number) {
    const n = Math.max(1, this.screens().length);
    this.index.update((i) => (i + step + n) % n);
    this.screenStarted = Date.now();
  }

  onLoaded(d: PanelData) {
    this.offline.set(!!d.offline);
    if (!d.offline) this.lastData.set(new Date(d.ranAt));
  }

  /** Keeps a wall screen from dimming. Browsers drop the lock when the tab is hidden, so it is taken again. */
  private async keepAwake() {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } };
      this.wake = (await nav.wakeLock?.request('screen')) ?? null;
    } catch {
      /* not supported or not allowed: the screen's own settings apply */
    }
  }

  private readonly onVisible = () => {
    if (document.visibilityState === 'visible') void this.keepAwake();
  };

  /** The pointer and controls fade away when nobody is touching the screen. */
  @HostListener('document:mousemove')
  @HostListener('document:keydown', ['$event'])
  wakeUp(e?: KeyboardEvent) {
    if (e?.key === 'ArrowRight') this.go(1);
    if (e?.key === 'ArrowLeft') this.go(-1);
    this.idle.set(false);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.idle.set(true), 3000);
  }

  fullscreen() {
    void document.documentElement.requestFullscreen?.().catch(() => undefined);
  }
}
