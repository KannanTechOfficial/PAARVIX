/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

/** How a panel shows its query's result. */
export type PanelVizType = 'kpi' | 'bar' | 'line' | 'pie' | 'table' | 'text';

/**
 * What a panel is for. Every device arranges panels by role, so the author decides once:
 * headline numbers first and largest, the main chart next, supporting charts smaller,
 * detail tables last (behind a sheet on a phone), notes as plain text.
 */
export type PanelRole = 'headline' | 'story' | 'supporting' | 'detail' | 'note';

export interface PanelViz {
  type: PanelVizType;
  /** Column used for labels (charts). Empty means the first text column. */
  label?: string;
  /** Column used for values (charts, KPI). Empty means the first number column. */
  value?: string;
  /** Plain text, for text panels only. */
  text?: string;
  /** Unit shown with a KPI value, e.g. "%" or "₹". */
  unit?: string;
  /**
   * Whether a rise is good news ("up", e.g. fees collected) or bad news ("down", e.g. students
   * below 75%). Colours the change green or red. Absent means neutral: no judgement is shown.
   */
  goodWhen?: 'up' | 'down';
}

/** One block on a dashboard. Position is on a 12-column grid and sets reading order. */
export interface DashboardPanel {
  id: string;
  title: string;
  /** Saved query the server runs for this panel. Absent for text panels. */
  queryId?: string;
  viz: PanelViz;
  /** Present from schema version 2. */
  role?: PanelRole;
  /** Section id. Present from schema version 2. */
  section?: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A named group of panels: a tab on a phone, a heading on a laptop, one screen on a TV. */
export interface DashboardSection {
  id: string;
  title: string;
}

/** Stored in Dashboard.config. Older versions are upgraded on load, so saved dashboards never break. */
export interface DashboardConfig {
  schemaVersion: 1 | 2;
  sections?: DashboardSection[];
  panels: DashboardPanel[];
}

export const DASHBOARD_COLUMNS = 12;
export const MAX_PANELS = 40;
export const MAX_SECTIONS = 12;

export const PANEL_VIZ_TYPES: PanelVizType[] = ['kpi', 'bar', 'line', 'pie', 'table', 'text'];
export const PANEL_ROLES: PanelRole[] = ['headline', 'story', 'supporting', 'detail', 'note'];

export function emptyDashboardConfig(): DashboardConfig {
  return { schemaVersion: 2, sections: [{ id: 'main', title: '' }], panels: [] };
}

/** The role a panel gets when the author has not chosen one. */
export function defaultRole(type: PanelVizType, isFirstChart = false): PanelRole {
  if (type === 'kpi') return 'headline';
  if (type === 'text') return 'note';
  if (type === 'table') return 'detail';
  return isFirstChart ? 'story' : 'supporting';
}

/** Reading order: top to bottom, then left to right, as laid out in the editor. */
export function byReadingOrder(a: DashboardPanel, b: DashboardPanel): number {
  return a.y - b.y || a.x - b.x;
}

/**
 * Brings any stored config to the current version. Version 1 had no sections or roles:
 * everything goes into one untitled section, and roles follow the panel type, with the
 * first chart as the main story.
 */
export function upgradeDashboardConfig(raw: DashboardConfig | null | undefined): DashboardConfig & { schemaVersion: 2; sections: DashboardSection[] } {
  const panels = [...(raw?.panels ?? [])];
  const sections = raw?.sections?.length ? raw.sections : [{ id: 'main', title: '' }];
  const known = new Set(sections.map((s) => s.id));
  const storyTaken = new Set<string>();
  const ordered = [...panels].sort(byReadingOrder);
  const upgraded = ordered.map((p) => {
    const section = p.section && known.has(p.section) ? p.section : sections[0].id;
    let role = p.role;
    if (!role) {
      const isChart = p.viz.type === 'bar' || p.viz.type === 'line' || p.viz.type === 'pie';
      role = defaultRole(p.viz.type, isChart && !storyTaken.has(section));
    }
    if (role === 'story') storyTaken.add(section);
    return { ...p, section, role };
  });
  return { schemaVersion: 2, sections, panels: upgraded };
}
