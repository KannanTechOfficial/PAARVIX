/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

export * from './dataframe';
export * from './downsample';
export * from './transformations';
export * from './query';

export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'json';

export interface DataFrameColumn {
  name: string;
  type: DataType;
  nullable?: boolean;
}

/**
 * Legacy/Tabular row-based DataFrame (for backward compatibility with tables/APIs)
 */
export interface DataFrame {
  columns: DataFrameColumn[];
  rows: Record<string, unknown>[];
  totalRows?: number;
}

export type PanelType =
  | 'line'
  | 'area'
  | 'bar'
  | 'pie'
  | 'table'
  | 'stat'
  | 'gauge'
  | 'heatmap'
  | 'markdown'
  | 'scatter';

export interface PanelConfig {
  id: string;
  title: string;
  type: PanelType;
  queryId?: string;
  options: Record<string, unknown>;
  gridPos: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface ConnectorCapabilities {
  supportsPushdown: boolean;
  supportsStreaming: boolean;
  supportsWrite: boolean;
}

export interface SchemaMetadata {
  tables: Array<{
    name: string;
    columns: DataFrameColumn[];
  }>;
}
