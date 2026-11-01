# Paarvix System Architecture

Paarvix is engineered from the ground up as a **modular monolith** optimized for sub-second interactions, zero GC thrashing, and low hardware resource consumption.

---

## 🛠️ Technology Stack

| Layer | Technology | Why We Chose It |
|---|---|---|
| **Frontend Framework** | **Angular 22 (Canary)** | Native fine-grained Signals, zoneless change detection (`provideZonelessChangeDetection`), OnPush rendering. |
| **Chart Visualisation** | **Apache ECharts 6.1** | Hardware-accelerated Canvas & WebGL rendering for 1M+ data points. |
| **Backend Framework** | **NestJS 12 (Fastify Adapter)** | TypeScript modular architecture with 2x throughput compared to Express. |
| **Database ORM** | **Prisma 7.10 (Driver Adapter)** | High-speed connection pooling via `@prisma/adapter-pg` with strict schema validation. |
| **Vector Math Engine** | **Columnar DataFrames** | In-memory typed vector buffers avoiding object hash-table overhead. |
| **Downsampling** | **LTTB Algorithm** | $O(N)$ Largest-Triangle-Three-Buckets algorithm preserving visual peaks in time series. |
| **Database** | **PostgreSQL 17** | Robust relational data store with read-only transaction guarantees. |

---

## 🏗️ Monorepo Structure

```
paarvix/
├── apps/
│   ├── api/             # NestJS Fastify API Gateway
│   └── web/             # Angular 22 Single Page Application
├── packages/
│   └── shared/          # Columnar DataFrame, LTTB downsampling & vector reducers
├── docs/                # Architecture records, guides, wiki
├── docker/              # Dockerfiles and multi-container Docker Compose
├── install.sh           # Automated installer
└── run.sh               # Operations controller
```

---

## ⚡ Columnar DataFrame Architecture

Unlike standard JSON arrays (`Array<Record<string, unknown>>`) which allocate millions of small heap objects and cause garbage collection stutter, Paarvix uses typed columnar vectors:

```ts
export interface Field<T = any> {
  name: string;
  type: 'time' | 'number' | 'string' | 'boolean';
  values: T[]; // Typed contiguous memory buffer
  labels?: Record<string, string>;
  config?: FieldConfig; // Thresholds, units, formatting
}

export interface ColumnarDataFrame {
  name?: string;
  fields: Field[];
  length: number;
}
```

This structure feeds directly into Canvas renderers without intermediate conversions, allowing smooth 60fps chart interactions.

