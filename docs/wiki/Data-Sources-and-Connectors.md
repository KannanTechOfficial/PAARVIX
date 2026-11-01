# Data Sources & Connectors

Paarvix connects to your existing business data wherever it lives.

---

## 🔌 Supported Connectors

| Connector | Type | Max Size / Limits | Capabilities |
|---|---|---|---|
| **Excel (.xlsx)** | File Import | Up to 50 MB | Multi-sheet auto-discovery, type inference, Indian number/date formatting, Tamil header preservation. |
| **Google Sheets** | Cloud Sync | Live Sheets | Public and private service-account sync with automated refresh intervals. |
| **MySQL / MariaDB** | Database | Live Query | Enforced read-only transactions, 30s timeout, 10,000 row cap, parameterised queries. |
| **PostgreSQL** | Database | Live Query | Direct connection pooling with SSL encryption and schema reflection. |
| **SQLite** | Local File | Embedded | Zero-config embedded database for standalone setups. |
| **REST / JSON** | API Feed | Dynamic | Ingest external webhooks and JSON payloads. |

---

## 🇮🇳 Indian & Regional Data Handling

* **Currency Formatting:** Automatically parses Indian comma grouping (`₹1,25,000` or `12,50,000`).
* **Date Parsing:** Respects `DD-MM-YYYY` day-first notation (`15-08-2026`).
* **Leading Zeroes:** Identifiers, pin codes, and telephone numbers (`00123`, `9876543210`) are strictly preserved as text rather than coerced to numbers.
* **Multilingual Column Names:** Native UTF-8 support for Tamil (e.g. `மொத்த விற்பனை`, `இருப்பு`).

---

## 🛡️ Isolated Import Worker

Spreadsheet parsing runs inside an isolated worker process (`import-worker.ts`) bounded by memory caps and strict execution deadlines. If a malformed or corrupt spreadsheet is uploaded, it cannot crash the main API server.

