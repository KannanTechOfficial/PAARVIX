# Connecting Your Data

Only an Admin can add data sources. Paarvix only reads your data. It never changes your files or databases.

> **Sensitive data:** files about students, patients and staff need care. Remove columns you do not need, such as Aadhaar numbers, before you upload. Paarvix stores imported data on your own server.

## Excel

1. Go to **Data Sources** and choose **Excel**.
2. Give the source a name, pick your `.xlsx` file, and upload it.
3. Open the source and check the preview.

Each sheet becomes one table. Empty sheets are skipped.

**Prepare your file**

- Put column names in the first row. Paarvix uses the first row that has content as the column names, so **remove any title row above them**.
- Keep one kind of value in a column. A column of numbers with the word "pending" in it is treated as text.
- Formulas are read using the last value Excel saved. Macros never run. A formula that gives TRUE or FALSE is read as 1 or 0.

**How values are read**

| In your file | Paarvix reads it as |
|---|---|
| `₹1,25,000` | The number 125000 |
| `15-08-2026` or `15/08/2026` | 15 August 2026, day first |
| `00123` | Text, so the leading zeros stay |
| Phone numbers and long IDs | Text, so no digits change |
| A whole number of 10 or more digits in a number cell | Text, so it cannot be added up. This affects amounts of ₹100 crore or more without decimals |

**Limits:** `.xlsx` only, 50 MB, 50 sheets, 500 columns, and 1,000,000 rows per sheet. For an `.xls` or CSV file, save it as `.xlsx` first.

**Updating:** Paarvix holds a copy of your data, so changes to your file do not appear on their own. Use **Replace file** to upload a new version. If the upload fails, your old data stays in place.

Saved queries that use a removed column will show "column no longer exists".

## Google Sheets

Paarvix copies your sheet and refreshes that copy. The source shows a **last synced** time, so you can see how recent the data is.

### A sheet anyone with the link can view

1. In Google Sheets, set sharing to **Anyone with the link** and **Viewer**. Only do this for data that is not private.
2. In Paarvix, choose **Google Sheet** and paste the link.

### A private sheet

Use this for anything sensitive. It takes about ten minutes, once.

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Enable the **Google Drive API**.
3. Create a **service account**, and create a **JSON key** for it. A file downloads.
4. Copy the service account's email address. It ends in `iam.gserviceaccount.com`.
5. Share your Google Sheet with that email address as **Viewer**.
6. In Paarvix, choose **Google Sheet**, paste the link, and paste the contents of the JSON file.

Treat the JSON key like a password. Paarvix stores it encrypted and never shows it again.

### Refreshing

Press **Sync** at any time. You can also choose an automatic refresh of every 15 minutes or longer. It is off by default.

If a sync fails, Paarvix keeps the old data and shows the reason.

Google will only export sheets up to about 10 MB. For a larger sheet, download it as `.xlsx` and upload it as Excel.

## MySQL and MariaDB

Paarvix reads these databases live, so there is no copy and no sync.

**First create a read-only user.** This is the most important safety step. Paarvix also refuses changes itself, but a read-only user is the real protection.

```sql
CREATE USER 'paarvix_reader'@'%' IDENTIFIED BY 'choose-a-strong-password';
GRANT SELECT ON your_database.* TO 'paarvix_reader'@'%';
```

Replace `%` with the Paarvix server's address if you can.

Then choose **MySQL**, enter the host, port (normally 3306), database, user and password, and press **Test**. Turn on **SSL** if the database is on another machine or network.

MySQL 5.7.8 or newer, or MariaDB, is needed.

## PostgreSQL

Create a read-only user:

```sql
CREATE USER paarvix_reader WITH PASSWORD 'choose-a-strong-password';
GRANT CONNECT ON DATABASE your_database TO paarvix_reader;
GRANT USAGE ON SCHEMA public TO paarvix_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO paarvix_reader;
```

Then choose **PostgreSQL**, enter the details, and press **Test**.

Never point a data source at Paarvix's own database.

## Query limits

To protect your systems, each query stops after 30 seconds and returns at most 10,000 rows. SQL can only be used on MySQL and PostgreSQL sources. Excel and Google Sheets sources use the no-code query path.

## Common problems

| Message | What to do |
|---|---|
| This file has no data | Check that a sheet has content. |
| Please upload an .xlsx file | Open the file in Excel and save it as `.xlsx`. |
| File is larger than 50 MB | Remove unused sheets or old rows. |
| This file is too large to read | The file is too big when opened, even if it looks small. Remove unused sheets, or split it into smaller files. |
| Paarvix cannot read this sheet | Share the sheet with the service account, or make it viewable by link. |
| This sheet is too large for Google to export | Download it as `.xlsx` and upload it as Excel. |
| Could not connect to the database | Check the host, port, password and firewall. |
| column no longer exists | The column was renamed or removed. Update your query. |
| Column names look wrong | A title row was used as the column names. Remove it and upload again. |
