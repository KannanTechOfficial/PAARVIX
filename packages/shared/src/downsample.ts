/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: paarvix@kannantech.com
 */

/**
 * Largest-Triangle-Three-Buckets (LTTB) algorithm
 * Downsamples high-frequency time series (e.g. 500k points -> 1000 points)
 * while preserving peaks, dips, and visual trends with O(N) complexity.
 */
export function lttbDownsample(
  timestamps: number[],
  values: number[],
  targetPoints: number,
): { timestamps: number[]; values: number[] } {
  const len = timestamps.length;
  if (targetPoints >= len || targetPoints <= 2) {
    return { timestamps, values };
  }

  const sampledTimestamps: number[] = new Array(targetPoints);
  const sampledValues: number[] = new Array(targetPoints);

  // Always keep the first point
  sampledTimestamps[0] = timestamps[0];
  sampledValues[0] = values[0];

  const bucketSize = (len - 2) / (targetPoints - 2);

  let aIdx = 0; // Point A (selected from previous bucket)

  for (let i = 0; i < targetPoints - 2; i++) {
    // Current bucket range
    const bucketStart = Math.floor((i + 0) * bucketSize) + 1;
    const bucketEnd = Math.min(Math.floor((i + 1) * bucketSize) + 1, len);

    // Next bucket average (Point C)
    const nextBucketStart = Math.floor((i + 1) * bucketSize) + 1;
    const nextBucketEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, len);

    let avgX = 0;
    let avgY = 0;
    const nextBucketLen = nextBucketEnd - nextBucketStart;

    if (nextBucketLen > 0) {
      for (let j = nextBucketStart; j < nextBucketEnd; j++) {
        avgX += timestamps[j];
        avgY += values[j];
      }
      avgX /= nextBucketLen;
      avgY /= nextBucketLen;
    } else {
      avgX = timestamps[len - 1];
      avgY = values[len - 1];
    }

    // Find point B in the current bucket that maximizes triangle area (A, B, C)
    const ax = timestamps[aIdx];
    const ay = values[aIdx];

    let maxArea = -1;
    let bestIdx = bucketStart;

    for (let k = bucketStart; k < bucketEnd; k++) {
      const bx = timestamps[k];
      const by = values[k];

      // Area of triangle: 0.5 * |(ax - avgX)(by - ay) - (ax - bx)(avgY - ay)|
      const area = Math.abs((ax - avgX) * (by - ay) - (ax - bx) * (avgY - ay)) * 0.5;

      if (area > maxArea) {
        maxArea = area;
        bestIdx = k;
      }
    }

    sampledTimestamps[i + 1] = timestamps[bestIdx];
    sampledValues[i + 1] = values[bestIdx];
    aIdx = bestIdx;
  }

  // Always keep the last point
  sampledTimestamps[targetPoints - 1] = timestamps[len - 1];
  sampledValues[targetPoints - 1] = values[len - 1];

  return {
    timestamps: sampledTimestamps,
    values: sampledValues,
  };
}

/**
 * Min-Max downsampling algorithm
 * Retains minimum and maximum peaks within each bucket to capture extreme outliers.
 */
export function minMaxDownsample(
  timestamps: number[],
  values: number[],
  targetPoints: number,
): { timestamps: number[]; values: number[] } {
  const len = timestamps.length;
  if (targetPoints >= len || targetPoints <= 4) {
    return { timestamps, values };
  }

  const buckets = Math.floor(targetPoints / 2);
  const bucketSize = Math.floor(len / buckets);

  const sampledTimestamps: number[] = [];
  const sampledValues: number[] = [];

  for (let b = 0; b < buckets; b++) {
    const start = b * bucketSize;
    const end = Math.min(start + bucketSize, len);

    let minVal = Infinity;
    let minIdx = start;
    let maxVal = -Infinity;
    let maxIdx = start;

    for (let i = start; i < end; i++) {
      const v = values[i];
      if (v < minVal) {
        minVal = v;
        minIdx = i;
      }
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    }

    // Preserve temporal order between min and max within bucket
    if (minIdx < maxIdx) {
      sampledTimestamps.push(timestamps[minIdx], timestamps[maxIdx]);
      sampledValues.push(values[minIdx], values[maxIdx]);
    } else {
      sampledTimestamps.push(timestamps[maxIdx], timestamps[minIdx]);
      sampledValues.push(values[maxIdx], values[minIdx]);
    }
  }

  return {
    timestamps: sampledTimestamps,
    values: sampledValues,
  };
}

