# Getting Started

Paarvix turns your organisation's data into clear, live information. It reads your data and never changes it.

It suits colleges, hospitals, shops, factories, offices and other organisations. Each organisation runs its own copy of Paarvix on its own server, so its data stays with it.

## Install

You need a Linux server or laptop with Docker. In the Paarvix folder, run:

```bash
./install.sh
```

The installer creates your settings and starts Paarvix.

## First login

1. Open Paarvix in your browser. The installer shows the address.
2. Create the first admin account. Use a strong password, and keep it safe.
3. Sign in.

Paarvix starts empty. It contains no sample data.

## Connect your data

Go to **Data Sources** and choose one:

| You have | Choose |
|---|---|
| An Excel file | Excel |
| A Google Sheet | Google Sheet |
| A MySQL or MariaDB database | MySQL |
| A PostgreSQL database | PostgreSQL |

See [Connecting your data](connecting-data.md) for each one.

After connecting, open the source to see its tables, columns and first rows. Check that the columns look right.

## Who can do what

| Action | Admin | Editor | Viewer |
|---|---|---|---|
| Add, replace, sync or remove data sources | Yes | No | No |
| See tables and query data | Yes | Yes | No |
| Write SQL on databases | Yes | Yes | No |

Only give Admin to people you trust with all your data. Viewers will receive data through dashboards when the dashboard builder is ready. See the [roadmap](../roadmap.md).

## If something goes wrong

- **Paarvix does not open:** run `docker ps` and check that the Paarvix containers are up.
- **A source will not connect:** see the common problems in [Connecting your data](connecting-data.md#common-problems).
- **Still stuck:** write to paarvix@kannantech.com. Never send passwords or real student, patient or staff data.
