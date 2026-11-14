/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, computed, effect, inject, input, output, signal,
  viewChild,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { type DashboardConfig, type DashboardPanel, type DashboardSection, byReadingOrder, upgradeDashboardConfig } from '@paarvix/shared';
import type { PanelData } from '../../../core/services/panel-data.service';
import { IconComponent } from '../../../core/ui/icon.component';
import { formatCell, isNumeric } from '../../../core/charts/format';
import { ViewerPanelComponent } from './viewer-panel.component';
import { haptic } from '../../../core/services/app-bar.service';

interface SectionView {
  section: DashboardSection;
  headlines: DashboardPanel[];
  stories: DashboardPanel[];
  supporting: DashboardPanel[];
  details: DashboardPanel[];
  notes: DashboardPanel[];
}

/** Below this width the dashboard is composed as a phone app. */
const PHONE_MAX = 700;
const PULL_TRIGGER = 72;

/**
 * Arranges a dashboard for the screen it is on. The content is authored once; each layout
 * composes it from panel roles and sections rather than shrinking one grid.
 */
@Component({
  selector: 'pvx-dashboard-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, IconComponent, ViewerPanelComponent],
  templateUrl: './dashboard-canvas.component.html',
  styleUrl: './dashboard-canvas.component.scss',
})
export class DashboardCanvasComponent implements AfterViewInit, OnDestroy {
  readonly dashboardId = input.required<string>();
  readonly config = input.required<DashboardConfig | null>();
  readonly asRole = input<string | null>(null);
  readonly refreshKey = input(0);
  readonly refresh = output<void>();

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private readonly sheetEl = viewChild<ElementRef<HTMLDialogElement>>('sheetDialog');

  readonly width = signal(1200);
  readonly phone = computed(() => this.width() < PHONE_MAX);
  readonly active = signal(0);
  readonly sheet = signal<{ panel: DashboardPanel; data: PanelData } | null>(null);
  readonly pull = signal(0);
  readonly visibleSection = signal('');
  private resize: ResizeObserver | null = null;
  private spy: IntersectionObserver | null = null;

  readonly sections = computed<SectionView[]>(() => {
    const cfg = upgradeDashboardConfig(this.config());
    return cfg.sections
      .map((section) => {
        const own = cfg.panels.filter((p) => p.section === section.id).sort(byReadingOrder);
        const of = (role: string) => own.filter((p) => p.role === role);
        return { section, headlines: of('headline'), stories: of('story'), supporting: of('supporting'), details: of('detail'), notes: of('note') };
      })
      .filter((s) => s.headlines.length + s.stories.length + s.supporting.length + s.details.length + s.notes.length > 0);
  });
  readonly tabbed = computed(() => this.phone() && this.sections().length > 1);
  readonly shown = computed(() => (this.tabbed() ? [this.sections()[Math.min(this.active(), this.sections().length - 1)]] : this.sections()));

  constructor() {
    // Keep the open tab in range when panels or sections change.
    effect(() => {
      if (this.active() >= this.sections().length) this.active.set(0);
    });
  }

  ngAfterViewInit() {
    const el = this.host.nativeElement as HTMLElement;
    this.resize = new ResizeObserver(([entry]) => this.zone.run(() => this.width.set(entry.contentRect.width)));
    this.resize.observe(el);
    this.watchSections();
  }

  ngOnDestroy() {
    this.resize?.disconnect();
    this.spy?.disconnect();
  }

  /** Desktop: the section navigation follows the reader's scroll. */
  private watchSections() {
    this.spy?.disconnect();
    if (!('IntersectionObserver' in window)) return;
    this.spy = new IntersectionObserver(
      (entries) => {
        const top = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (top) this.zone.run(() => this.visibleSection.set((top.target as HTMLElement).dataset['section'] ?? ''));
      },
      { rootMargin: '-80px 0px -60% 0px' },
    );
    setTimeout(() => (this.host.nativeElement as HTMLElement).querySelectorAll('section[data-section]').forEach((s) => this.spy?.observe(s)));
  }

  goTo(id: string) {
    const el = (this.host.nativeElement as HTMLElement).querySelector(`section[data-section="${CSS.escape(id)}"]`);
    el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  // ---------- phone: tabs, swipe, pull to refresh ----------
  selectTab(i: number) {
    if (i !== this.active()) haptic();
    const go = () => {
      this.active.set(i);
      window.scrollTo({ top: 0 });
    };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(go);
    else go();
  }

  private touch: { x: number; y: number; atTop: boolean } | null = null;

  onTouchStart(e: TouchEvent) {
    const t = e.touches[0];
    this.touch = { x: t.clientX, y: t.clientY, atTop: window.scrollY <= 0 };
  }

  onTouchMove(e: TouchEvent) {
    if (!this.touch?.atTop) return;
    const dy = e.touches[0].clientY - this.touch.y;
    const dx = Math.abs(e.touches[0].clientX - this.touch.x);
    if (dy > 0 && dy > dx) this.pull.set(Math.min(dy * 0.5, PULL_TRIGGER * 1.3));
  }

  onTouchEnd(e: TouchEvent) {
    const start = this.touch;
    this.touch = null;
    if (!start) return;
    if (this.pull() >= PULL_TRIGGER) {
      haptic(12);
      this.refresh.emit();
    }
    this.pull.set(0);
    // A clear sideways swipe moves between sections; anything else is a scroll.
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = t.clientY - start.y;
    if (this.tabbed() && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) {
      const next = this.active() + (dx < 0 ? 1 : -1);
      if (next >= 0 && next < this.sections().length) this.selectTab(next);
    }
  }

  // ---------- detail sheet ----------
  openSheet(ev: { panel: DashboardPanel; data: PanelData }) {
    this.sheet.set(ev);
    setTimeout(() => this.sheetEl()?.nativeElement.showModal());
  }

  // Drag the sheet down by its header to close it, like a native sheet.
  readonly sheetDrag = signal(0);
  private dragFrom: number | null = null;

  sheetDragStart(e: TouchEvent) {
    this.dragFrom = e.touches[0].clientY;
  }

  sheetDragMove(e: TouchEvent) {
    if (this.dragFrom === null) return;
    this.sheetDrag.set(Math.max(0, e.touches[0].clientY - this.dragFrom));
  }

  sheetDragEnd() {
    const far = this.sheetDrag() > 120;
    this.dragFrom = null;
    this.sheetDrag.set(0);
    if (far) this.closeSheet();
  }

  closeSheet() {
    this.sheetEl()?.nativeElement.close();
    this.sheet.set(null);
  }

  cell(v: unknown) {
    return formatCell(v);
  }

  isNum(v: unknown) {
    return isNumeric(v);
  }
}
