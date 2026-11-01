# Security & Permissions

Security and data ownership are core architectural principles in OmniViz.

---

## 🔒 Security Architecture

1. **Read-Only by Default:**
   * Database connectors always establish read-only transactions (`SET TRANSACTION READ ONLY`).
   * Destructive statements (`DROP`, `ALTER`, `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`) are blocked by the SQL guard compiler before reaching the database.
2. **Encrypted Credentials:**
   * Connection strings, passwords, and service account keys are encrypted using AES-256-GCM envelope encryption (`PAARVIX_ENCRYPTION_KEY`).
   * Passwords are never sent back to the browser in API responses.
3. **Role-Based Access Control (RBAC):**
   * **Admin:** Full system configuration, user management, and connector setup.
   * **Editor:** Create and modify dashboards, manage queries, view data.
   * **Viewer:** Read-only dashboard viewer with filter interaction.
4. **Isolated Process Boundaries:**
   * User file imports run in memory-capped sub-processes.
   * Query limits (10,000 rows max, 30s timeout) prevent Denial of Service.
5. **No Telemetry / Egress:**
   * Your data remains strictly on your server. OmniViz does not send phone-home telemetry.
