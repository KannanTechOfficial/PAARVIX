/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

export type FieldType = 'time' | 'number' | 'string' | 'boolean' | 'other';

export interface ThresholdStep {
  value: number;
  color: string;
}

export interface ThresholdConfig {
  mode: 'absolute' | 'percentage';
  steps: ThresholdStep[];
}

export type UnitType =
  | 'percent'
  | 'percent_unit' // 0.0 - 1.0
  | 'bytes'
  | 'kbytes'
  | 'mbytes'
  | 'gbytes'
  | 'bytes_sec'
  | 'ms'
  | 's'
  | 'ops'
  | 'short'
  | 'currency_inr';

export interface FieldConfig {
  displayName?: string;
  unit?: UnitType;
  decimals?: number;
  min?: number;
  max?: number;
  thresholds?: ThresholdConfig;
  custom?: Record<string, unknown>;
}

export interface Field<T = any> {
  name: string;
  type: FieldType;
  values: T[];
  labels?: Record<string, string>;
  config?: FieldConfig;
}

export interface ColumnarDataFrame {
  name?: string;
  refId?: string;
  fields: Field[];
  length: number;
}

/**
 * Creates a ColumnarDataFrame from fields
 */
export function createColumnarDataFrame(
  fields: Field[],
  name?: string,
  refId?: string,
): ColumnarDataFrame {
  const length = fields.length > 0 ? fields[0].values.length : 0;
  // Verify all fields have identical length
  for (const field of fields) {
    if (field.values.length !== length) {
      throw new Error(
        `Field "${field.name}" has length ${field.values.length}, expected ${length}`,
      );
    }
  }
  return {
    name,
    refId,
    fields,
    length,
  };
}

/**
 * Helper to extract time series (timestamp array + numeric value array)
 */
export function extractTimeSeries(frame: ColumnarDataFrame): {
  timestamps: number[];
  series: Array<{ name: string; values: number[]; labels?: Record<string, string>; config?: FieldConfig }>;
} {
  const timeField = frame.fields.find((f) => f.type === 'time');
  const timestamps = timeField ? (timeField.values as number[]) : [];

  const series = frame.fields
    .filter((f) => f.type === 'number')
    .map((f) => ({
      name: f.config?.displayName || f.name,
      values: f.values as number[],
      labels: f.labels,
      config: f.config,
    }));

  return { timestamps, series };
}

