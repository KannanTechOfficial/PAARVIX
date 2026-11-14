/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import {
  DASHBOARD_COLUMNS, type DashboardConfig, type DashboardPanel, type DashboardSection, MAX_PANELS, MAX_SECTIONS, PANEL_ROLES, PANEL_VIZ_TYPES,
  type PanelVizType, defaultRole, upgradeDashboardConfig,
} from '@paarvix/shared';
import { CompactType, DisplayGrid, Gridster, type GridsterConfig, GridsterItem, type GridsterItemConfig, GridType } from 'angular-gridster2';
import { AuthService } from '../../core/services/auth.service';
import { AdminApiService, type AdminUser, type Role, errorText } from '../../core/services/admin-api.service';
import { DashboardsApiService, type DashboardItem } from '../../core/services/dashboards-api.service';
import { IconComponent } from '../../core/ui/icon.component';
import { QueriesApiService, type SavedQuery } from '../queries/queries-api.service';
import { PanelComponent } from './panel.component';
import { AppBarService } from '../../core/services/app-bar.service';
import { DashboardCanvasComponent } from './viewer/dashboard-canvas.component';

/** Gridster keeps its own position fields; the panel rides along. */
type GridItem = GridsterItemConfig & { panel: DashboardPanel };

const ROW_PX = 80;
const newId = () => `p${Math.random().toString(36).slice(2, 10)}`;

@Component({
  selector: 'pvx-dashboard-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, TranslatePipe, IconComponent, PanelComponent, Gridster, GridsterItem, DashboardCanvasComponent],
  templateUrl: './dashboard-view.component.html',
  styleUrl: './dashboard-view.component.scss',
})
export class DashboardViewComponent implements OnInit, OnDestroy {
  private readonly appBar = inject(AppBarService);
  private readonly titleEl = viewChild<ElementRef<HTMLElement>>('pageTitle');
  private titleObserver: IntersectionObserver | null = null;

  constructor() {
    // The phone top bar takes over the title once the large one scrolls out of view.
    effect(() => {
      this.appBar.title.set(this.dashboard()?.title ?? '');
      const el = this.titleEl()?.nativeElement;
      this.titleObserver?.disconnect();
      if (!el || !('IntersectionObserver' in window)) return;
      this.titleObserver = new IntersectionObserver(([e]) => this.appBar.showTitle.set(!e.isIntersecting), { rootMargin: '-56px 0px 0px 0px' });
      this.titleObserver.observe(el);
    });
  }

  ngOnDestroy() {
    this.titleObserver?.disconnect();
    this.appBar.title.set('');
    this.appBar.showTitle.set(false);
  }

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(DashboardsApiService);
  private readonly admin = inject(AdminApiService);
  private readonly queries = inject(QueriesApiService);
  readonly auth = inject(AuthService);
  private readonly t = inject(TranslateService);

  readonly dashboard = signal<DashboardItem | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly refreshKey = signal(0);
  readonly asRole = signal<string | null>(null);
  readonly roles = signal<Role[]>([]);
  readonly people = signal<AdminUser[]>([]);
  readonly savedQueries = signal<SavedQuery[]>([]);

  // Editor state
  readonly items = signal<GridItem[]>([]);
  readonly selected = signal<string | null>(null);
  readonly showSettings = signal(false);
  title = '';
  description = '';
  roleIds = new Set<string>();

  readonly vizTypes = PANEL_VIZ_TYPES;
  readonly roles_ = PANEL_ROLES;
  readonly sections = signal<DashboardSection[]>([]);
  readonly canManage = computed(() => this.auth.can('dashboards:write') && !this.auth.user()?.locked);
  readonly canPreview = computed(() => this.canManage() && this.auth.can('roles:read'));
  readonly previewRoleName = computed(() => {
    const as = this.asRole();
    if (as?.startsWith('user:')) return this.people().find((u) => u.id === as.slice(5))?.name ?? '';
    return this.roles().find((r) => r.id === as)?.name ?? '';
  });
  readonly panels = computed(() => this.dashboard()?.config?.panels ?? []);
  readonly selectedItem = computed(() => this.items().find((i) => i.panel.id === this.selected()) ?? null);

  readonly gridOptions: GridsterConfig = {
    gridType: GridType.VerticalFixed,
    fixedRowHeight: ROW_PX,
    minCols: DASHBOARD_COLUMNS,
    maxCols: DASHBOARD_COLUMNS,
    minRows: 6,
    margin: 12,
    outerMargin: false,
    compactType: CompactType.CompactUp,
    displayGrid: DisplayGrid.OnDragAndResize,
    pushItems: true,
    draggable: { enabled: true, ignoreContent: true, dragHandleClass: 'drag' },
    resizable: { enabled: true },
    minItemCols: 2,
    minItemRows: 2,
    itemChangeCallback: () => this.items.update((list) => [...list]),
  };

  ngOnInit() {
    this.route.paramMap.subscribe((p) => {
      const id = p.get('id');
      if (id) this.load(id);
    });
    if (this.canManage()) {
      this.admin.roles().subscribe({ next: (r) => this.roles.set(r), error: () => undefined });
      if (this.auth.can('users:read')) {
        this.admin.users().subscribe({ next: (u) => this.people.set(u.filter((x) => x.isActive)), error: () => undefined });
      }
    }
  }

  private load(id: string) {
    this.error.set('');
    this.api.get(id, this.asRole()).subscribe({
      next: (d) => {
        if (d.template) {
          this.router.navigateByUrl(d.slug === 'student-portfolio' ? '/dashboards/student-portfolio' : '/dashboards/college-analytics');
          return;
        }
        this.dashboard.set(d);
        if (this.route.snapshot.queryParamMap.get('edit') && d.canEdit) this.startEdit();
        const add = this.route.snapshot.queryParamMap.get('addQuery');
        if (add && d.canEdit) this.startEdit(add);
      },
      error: (e) => {
        this.dashboard.set(null);
        this.error.set(e?.status === 404 ? this.t.instant('dashboards.notFound') : errorText(e));
      },
    });
  }

  refresh() {
    this.refreshKey.update((k) => k + 1);
  }

  /** Shows the dashboard as a chosen role would see it. The server checks the role, so this is exact. */
  previewAs(roleId: string) {
    this.asRole.set(roleId || null);
    const d = this.dashboard();
    if (d) this.load(d.id);
  }

  // ---------- editing ----------
  startEdit(addQueryId?: string) {
    const d = this.dashboard();
    if (!d?.canEdit) return;
    this.asRole.set(null);
    this.title = d.title;
    this.description = d.description ?? '';
    this.roleIds = new Set(d.roleIds ?? []);
    const cfg = upgradeDashboardConfig(d.config);
    this.sections.set(cfg.sections.map((s) => ({ ...s })));
    this.items.set(cfg.panels.map((p) => ({ x: p.x, y: p.y, cols: p.w, rows: p.h, panel: { ...p, viz: { ...p.viz } } })));
    this.selected.set(null);
    this.editing.set(true);
    this.queries.saved().subscribe({
      next: (q) => {
        this.savedQueries.set(q);
        if (addQueryId) {
          const found = q.find((x) => x.id === addQueryId);
          if (found) this.addPanel(found.id, found.name);
          this.router.navigate([], { queryParams: {}, replaceUrl: true });
        }
      },
      error: () => undefined,
    });
  }

  cancelEdit() {
    this.editing.set(false);
    this.selected.set(null);
  }

  addPanel(queryId?: string, title?: string) {
    if (this.items().length >= MAX_PANELS) {
      this.error.set(this.t.instant('dashboards.tooMany', { count: MAX_PANELS }));
      return;
    }
    const y = Math.max(0, ...this.items().map((i) => i.y + i.rows));
    const type: PanelVizType = queryId || this.savedQueries().length ? 'bar' : 'text';
    const section = this.sections()[this.sections().length - 1]?.id ?? 'main';
    const hasStory = this.items().some((i) => i.panel.section === section && i.panel.role === 'story');
    const panel: DashboardPanel = {
      id: newId(),
      title: title ?? '',
      queryId: queryId ?? this.savedQueries()[0]?.id,
      viz: { type, text: '' },
      role: defaultRole(type, !hasStory),
      section,
      x: 0, y, w: 6, h: 4,
    };
    this.items.update((list) => [...list, { x: 0, y, cols: 6, rows: 4, panel }]);
    this.selected.set(panel.id);
  }

  removePanel(id: string) {
    this.items.update((list) => list.filter((i) => i.panel.id !== id));
    if (this.selected() === id) this.selected.set(null);
  }

  updatePanel(id: string, patch: Partial<DashboardPanel>, vizPatch?: Partial<DashboardPanel['viz']>) {
    this.items.update((list) => list.map((i) => {
      if (i.panel.id !== id) return i;
      const panel = { ...i.panel, ...patch, viz: { ...i.panel.viz, ...(vizPatch ?? {}) } };
      if (panel.viz.type === 'text') panel.queryId = undefined;
      else if (!panel.queryId) panel.queryId = this.savedQueries()[0]?.id;
      return { ...i, panel };
    }));
  }

  /** Changing the chart type also moves the panel to that type's usual role, unless the author picked another. */
  setVizType(id: string, type: PanelVizType) {
    const item = this.items().find((i) => i.panel.id === id);
    const wasDefault = !item?.panel.role || item.panel.role === defaultRole(item.panel.viz.type, item.panel.role === 'story');
    this.updatePanel(id, wasDefault ? { role: defaultRole(type, item?.panel.role === 'story') } : {}, { type });
  }

  // ---------- sections ----------
  addSection() {
    if (this.sections().length >= MAX_SECTIONS) return;
    this.sections.update((s) => [...s, { id: `s${Math.random().toString(36).slice(2, 8)}`, title: '' }]);
  }

  renameSection(id: string, title: string) {
    this.sections.update((s) => s.map((x) => (x.id === id ? { ...x, title } : x)));
  }

  /** Panels in a removed section move to the first section; nothing is lost. */
  removeSection(id: string) {
    const rest = this.sections().filter((s) => s.id !== id);
    if (!rest.length) return;
    this.sections.set(rest);
    this.items.update((list) => list.map((i) => (i.panel.section === id ? { ...i, panel: { ...i.panel, section: rest[0].id } } : i)));
  }

  toggleRole(id: string, on: boolean) {
    if (on) this.roleIds.add(id);
    else this.roleIds.delete(id);
  }

  save() {
    const d = this.dashboard();
    if (!d) return;
    const config: DashboardConfig = {
      schemaVersion: 2,
      sections: this.sections().map((s) => ({ id: s.id, title: s.title.trim() })),
      panels: this.items().map((i) => ({ ...i.panel, x: i.x, y: i.y, w: i.cols, h: i.rows })),
    };
    this.saving.set(true);
    this.api.save(d.id, { title: this.title.trim(), description: this.description.trim(), config, roleIds: [...this.roleIds], version: d.version }).subscribe({
      next: (saved) => {
        this.dashboard.set(saved);
        this.saving.set(false);
        this.editing.set(false);
        this.error.set('');
        this.notice.set(this.t.instant('dashboards.saved'));
        this.refresh();
      },
      error: (e) => {
        this.saving.set(false);
        this.error.set(errorText(e));
      },
    });
  }

  deleteDashboard() {
    const d = this.dashboard();
    if (!d || !confirm(this.t.instant('dashboards.confirmDelete', { name: d.title }))) return;
    this.api.remove(d.id).subscribe({
      next: () => this.router.navigateByUrl('/dashboards'),
      error: (e) => this.error.set(errorText(e)),
    });
  }

  queryName(id?: string) {
    return this.savedQueries().find((q) => q.id === id)?.name ?? '';
  }
}
