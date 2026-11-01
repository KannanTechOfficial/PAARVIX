# Connecting College Data

Paarvix contains no sample data. College dashboards read only from a PostgreSQL data source that you connect.

## Steps

1. Set `PAARVIX_ENCRYPTION_KEY` in the API environment: `openssl rand -hex 32`. Keep it safe; losing it means re-entering data source passwords.
2. Create a read-only database user.
3. Create the two objects below as tables or views in your database.
4. Go to **Data Sources**, add the database, and click **Test**.
5. Go to **Templates**, pick the source, and click **Apply template**.

## Required objects

```sql
CREATE TABLE paarvix_college_analytics (data jsonb NOT NULL);

CREATE TABLE paarvix_students (
  reg_no        text PRIMARY KEY,
  official_mail text UNIQUE,
  data          jsonb NOT NULL
);
```

The `data` JSON must match `CollegeAnalytics` and `StudentProfile` in `apps/api/src/college/college.types.ts`.

## Access

| Role | Own record | Any student | Analytics |
|---|---|---|---|
| Admin, Editor | Yes | Yes | Yes |
| Viewer | Yes, matched by login email | No | No |

Queries run in a read-only transaction with a 30-second timeout and a 10,000-row limit.
