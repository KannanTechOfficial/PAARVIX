# 12. Gaps and Opportunities

Where Grafana leaves users unserved, and what Paarvix does about each. Written 2026-11-14. It extends the short "Gaps to win" list in [doc 8](08-lessons-for-paarvix.md).

**Clean-room rule:** ideas only. Nothing here is copied from Grafana code, UI or text.

## Evidence labels

The labels from the [README](README.md) apply, plus one new label:

- **[S] Sourced:** read from a public page or the public issue tracker on 2026-11-14. Links are at the end.

Vote counts are thumbs-up reactions on open issues in `grafana/grafana`, taken on 2026-11-14. They show what existing Grafana users ask for most. They do not show what a college or a shop needs, because those people are not Grafana users.

## Summary

| # | Gap | Strength of evidence | Paarvix answer |
|---|---|---|---|
| 1 | The viewer cannot be redesigned or rebranded in the free edition | Strong | Five-layer theming |
| 2 | Shared links lose filters; PDF and scheduled reports are paid | Strong | Filters on public links; PDF export |
| 3 | No path for spreadsheets or non-technical users | Strong | Excel first, templates, plain-language questions |
| 4 | Number formats are Western only | Strong | Lakh/crore, ₹, DD-MM-YYYY by default |
| 5 | No Indian languages, and outsiders cannot add one | Strong | Tamil and English first, open translation files |
| 6 | Access control protects dashboards, not data | Strong, tested | Query permission follows the dashboard |
| 7 | Alerting is hard to set up and misses common channels | Medium | Plain-language rules, recipient required, WhatsApp |
| 8 | Embedding in another app is fragile | Medium | Signed embed tokens |
| 9 | Phone use is an afterthought | Medium | Phone-first viewer |
| 10 | Long-requested dashboard features remain open | Strong | Build into the dashboard model from the start |
| 11 | Upgrades break dashboards and plugins | Medium | Versioned dashboard schema, stable plugin contract |

## 1. Viewer design and branding

- Logo, app title, login background, favicon and footer links are settings marked Enterprise only. **[S]**
- Community answers state there is no supported way to rebrand the free edition. People patch built files or rewrite text in a proxy, and both break on upgrade. **[S]**
- The free edition offers a fixed set of built-in themes. No documented option accepts a custom stylesheet. A third-party theme plugin that did this is deprecated. **[S]**
- "Custom default colours palette" has been open since 2019 with 236 votes. "High contrast visualisation colour palette" has 39. **[S]**
- "Allow kiosk mode to be the default" (41) and "iframe dashboard and prevent any navigation" (37) show that people want a clean view-only surface and cannot get one. **[S]**
- No logo or app-name setting was found in the free edition's config. **[O]**, doc 5.

**Paarvix answer [R]:** five override layers on top of the default design. See "Theming design" below.

## 2. Sharing and reports

- Shared public dashboards do not support filter variables. The request has 184 votes, and a user reported the same limit on 12.3.1. **[S]**
- Public dashboards also exclude reusable panels and live streams, and several data sources are listed as unsupported, including Google Sheets. **[S]**
- Export of a dashboard to PDF is Enterprise only. Scheduled email reports are Enterprise and paid Cloud only. **[S]**
- Image export needs a separate rendering service that is no longer bundled. **[S]**
- "Export all dashboards" has been open since 2014 with 99 votes. **[S]**

**Paarvix answer [R]:**
- Public links carry a fixed, admin-approved set of filters. The server holds the query, as already planned.
- Single-dashboard PDF and PNG export in Community, rendered in the browser so no extra service is needed. Scheduled reports stay Pro, as in `CLAUDE.md` §7.8.
- One-command export of every dashboard through the CLI.

## 3. Spreadsheets and non-technical users

- Grafana has no built-in CSV or Excel source. The older CSV plugin is deprecated, with support ending 2027-02-01. **[S]**
- The suggested replacement reads CSV from a URL or pasted text. A reviewer had to label every column and reformat dates by hand before it worked. No source confirms that it reads `.xlsx` files. **[S]**
- Comparison articles describe a steep learning curve for people who are not engineers. These are blogs, so treat this as opinion. **[S]**
- A new install shows a tutorial and no data. **[O]**, doc 5.
- Click-to-filter between charts and drill-down to detail are weaker than in business-intelligence tools. **[K]**, not tested.

**Paarvix answer [R]:** already the core of the product. Excel and Google Sheets import with automatic column types, one-click templates, and the no-code query builder. Add cross-filtering and drill-down to the dashboard builder at the phase set in `CLAUDE.md` §7.4.

## 4. Number and date formats

- "Decimal mark with comma and thousand separator with dot" has been open since 2016 with 123 votes. **[S]**
- If European separators are still unresolved, Indian grouping (1,00,000) and lakh/crore units are not available either. **[K]**

**Paarvix answer [R]:** Indian formats are the default, with a per-organisation locale setting for others.

## 5. Languages

- The 13.0.2 build ships 19 languages. None is Indian. **[O]**, doc 5.
- Translation is run through the vendor's own translation project. A 2025 community thread asks whether a language can be added any other way. **[S]**

**Paarvix answer [R]:** English and Tamil in P1. Translation files stay plain JSON in the repo, so a contributor can add a language with a pull request.

## 6. Access control

All tested in doc 4. **[O]**

- A Viewer who is locked out of a folder can still send custom SQL to the query API and get rows back.
- Per-data-source permissions and custom roles are not available in the free edition.
- Row-level rules do not exist. Separation needs one organisation per department.
- Related open requests: "Organisations provisioning" (73 votes), "Provisioning service accounts" (52). **[S]**

**Paarvix answer [R]:**
- Viewers run saved queries only, and only for panels they may see.
- Permissions written as `resource:verb` behind fixed roles. Per-source permissions in Community.
- User attributes (department, year) drive row rules, so one HOD role serves every department.
- Further ideas, each needing an edition decision: "view as" preview, an access explainer, temporary grants, access requests, delegated admin, bulk user import from Excel, access review report, sensitive-column tags.

## 7. Alerting

- Grafana's own blog says its earlier routing model "was confusing to lots of users". Forum users still ask how rules, contact points and policies relate. **[S]**
- A new alert rule notifies nobody until routing is set up. **[O]**, doc 6.
- Rules can only use data sources that have a server-side part. **[S]**
- Open requests: update an existing chat message instead of posting a new one (92 votes), disable "resolved" messages per rule (41), Git sync for alert rules (202). **[S]**
- WhatsApp is not in the channel list. **[O]**, doc 6.

**Paarvix answer [R]:** one-screen rule in plain language ("tell me when attendance falls below 75%"), a recipient is required before saving, and email first. WhatsApp and the other channels follow in Pro, as in `CLAUDE.md` §7.8.

## 8. Embedding

- Embedding needs a server setting that is off by default and unavailable in the hosted product. **[S]**
- Across domains it also needs cookie changes and HTTPS. Signed-token login needs a key source, or it silently falls back to the login page. **[S]**
- The docs warn that a token in the URL can leak through logs. **[S]**

**Paarvix answer [R]:** short-lived signed embed tokens with a domain allow-list, passed outside the URL. This is the Embed SDK in `CLAUDE.md` §7.11, Enterprise, P3. The viewer shell built for theming makes it cheaper, because it is already separate from the admin shell.

## 9. Phones

- "Better touch interactions for mobile" on time-series charts has been open since 2017 with 59 votes. **[S]**
- Forum reports describe panels that vanish on iOS, dashboards that keep resizing on Android, and a fixed stacking order on small screens. These reports are old and anecdotal. **[S]**
- A staff reply says mobile work has focused on viewing, not editing. **[S]**

**Paarvix answer [R]:** the viewer is designed for a phone first. Each dashboard can set its own panel order for small screens. Building stays a desktop task.

## 10. Long-open dashboard requests

The most-voted open issues, as a list of what to design in from the start. **[S]**

| Votes | Opened | Request | Paarvix |
|---|---|---|---|
| 413 | 2017 | Per-panel variables | Filters scoped to dashboard, section or panel. Grafana shipped section-level variables in 13.1, so this is partly answered there |
| 316 | 2014 | Playlists that use variables | TV-mode playlists store a filter set per slide |
| 213 | 2018 | Variables in provisioned dashboards | Dashboards-as-code keeps filters |
| 200 | 2016 | Limit the time range per source or dashboard | Query cost guard and per-source row and range limits |
| 131 | 2017 | Bars and lines in one chart | Combo panel, P2 |
| 113 | 2018 | Panel groups | Sections and tabs in the dashboard model |
| 108 | 2015 | Box plot | P2 panel list |
| 97 | 2023 | Refresh interval per panel | Per-panel refresh |
| 91 | 2016 | Allow an empty filter value | "All" and "none" as first-class filter states |
| 90 | 2023 | Extra fields in tooltips | Tooltip fields chosen in panel options |
| 71 | 2024 | Stacking groups in bar charts | Bar panel options |
| 62 | 2024 | DuckDB data source | DuckDB is already in the planned engine |
| 61 | 2014 | Auto-save | Draft auto-save in the builder, with undo |

## 11. Upgrades

- Older plugins built on a retired framework were switched off by default in v11 and removed in v12. Dashboards using them show a warning in place of the panel. **[S]**
- The image rendering plugin was deprecated in 2025 and must now be run as a separate service. **[S]**
- Two storage generations are live at once. **[O]**, doc 1.

**Paarvix answer [R]:** a schema version on every dashboard with automatic upgrade on load, one resource model, and a small plugin contract (`CLAUDE.md` §8.3) that plugins target, so a change inside the core does not break them.

## Theming design

Founder decision, 2026-11-14: build all five layers. Edition and phase for each layer are still open.

The default design ships in the core. A theme is data layered on top. The core reads it and never runs it.

| Layer | What changes | Stored as |
|---|---|---|
| 0. Default | Nothing; the Paarvix design | Core |
| 1. Tokens | Colours, fonts, radius, spacing, density, logo, light and dark | JSON |
| 2. Layout | Navigation position, header, login page, home page, panel frame, chart palette | JSON choosing from fixed options |
| 3. Page templates | Viewer pages built from blocks in a visual editor | JSON listing blocks and settings |
| 4. Custom CSS | Free-form styling | Sanitised stylesheet, scoped to the viewer |
| 5. Custom components | New viewer widgets | Sandboxed plugin |

Safety rules:

1. No scripts in layers 1 to 4. Scripts run only in layer 5, inside a sandbox.
2. Custom CSS is cleaned: no external addresses and no imports.
3. The Administration area always uses the default design, so a broken theme cannot lock an admin out.
4. A safe-mode address loads the default design.
5. Themes have draft, preview, publish and roll back.
6. Text contrast is checked on save.
7. A theme never changes what data a user may see. The API still decides that.

Requirements this places on current work:

- Every component takes colour, type and spacing from tokens. No fixed values in component styles.
- The viewer shell and the admin shell are separate, inside one app.

## Do not chase

Unchanged from doc 8: logs, traces, profiling, a 100-plus source catalogue and very large monitoring setups. Several high-vote issues are about those areas and were left out of this document for that reason.

## Limits of this study

- No new lab work. Sections 1, 2, 3, 7, 8, 9 and 11 rest on public pages, not on tests.
- Forum threads and comparison blogs are opinion. Each is marked where used.
- Vote counts change, and an open issue may be partly solved. One such case is noted in section 10.
- Enterprise and Cloud were not tested, so "paid only" means "documented as paid only".
- The current language list was not re-checked against a build newer than 13.0.2.

## Sources

Read on 2026-11-14.

- [grafana/grafana open issues, sorted by thumbs-up](https://github.com/grafana/grafana/issues?q=is%3Aissue+is%3Aopen+sort%3Areactions-%2B1-desc)
- [Configure custom branding](https://grafana.com/docs/grafana/latest/enterprise/white-labeling/)
- [Community: "Lite" white labelling with the free edition](https://community.grafana.com/t/question-lite-white-labeling-allowed-with-oss-grafana/50742)
- [Community: hide the version on the login page, 13.1.0](https://community.grafana.com/t/how-to-hide-grafana-version-from-the-login-page-in-grafana-oss-v13-1-0/163490)
- [Introducing experimental themes](https://grafana.com/whats-new/2025-04-11-introducing-experimental-themes/)
- [Community: custom themes and styles](https://community.grafana.com/t/custom-themes-styles-the-final-frontier/108236)
- [Externally shared dashboards](https://grafana.com/docs/grafana/latest/dashboards/dashboard-public/)
- [Community: template variables on public dashboards](https://community.grafana.com/t/template-variables-on-public-dashboard/161389)
- [Share dashboards and panels](https://grafana.com/docs/grafana/latest/dashboards/share-dashboards-panels/)
- [Create and manage reports, v13.1](https://grafana.com/docs/grafana/v13.1/visualizations/dashboards/create-reports.md)
- [What's new in the image renderer](https://grafana.com/blog/whats-new-in-the-grafana-image-renderer-higher-quality-results-security-enhancements-and-more)
- [How to visualise CSV data](https://grafana.com/blog/how-to-visualize-csv-data-with-grafana)
- [CSV data source plugin docs](https://grafana.com/docs/plugins/marcusolsson-csv-datasource/latest.md)
- [Review: CSV support](https://virtualizationreview.com/Articles/2024/11/12/Grafana-Open-Source-Data-Viz-Solution-Part-2-CSV-Support.aspx)
- [Comparison: Metabase, Superset and Grafana](https://www.modern-datatools.com/compare/metabase-vs-superset-vs-grafana)
- [Community: adding new languages](https://community.grafana.com/t/grafana-oss-can-we-add-new-languages-manually-or-must-all-new-languages-go-through-the-official-crowdin-project/162028)
- [Simplified routing in alerting](https://grafana.com/blog/simplified-routing-in-grafana-alerting-easy-secure-and-powerful)
- [Community: how alert routing works](https://community.grafana.com/t/how-does-alert-routing-work-between-alert-rules-and-notification-policies-in-grafana-alerting/161541)
- [Data sources and alerting](https://grafana.com/docs/grafana/v10.0/alerting/fundamentals/data-source-alerting)
- [Configure JWT authentication](https://grafana.com/docs/grafana/latest/setup-grafana/configure-access/configure-authentication/jwt/)
- [Community: authenticating in an iframe through a proxy](https://community.grafana.com/t/authenticating-grafana-in-an-iframe-via-reverse-proxy/119919)
- [Community: dashboard keeps resizing on a phone](https://community.grafana.com/t/on-mobile-phone-dashboard-is-constantly-resizing/55116)
- [Community: order of panels on mobile](https://community.grafana.com/t/order-of-panels-when-viewing-on-mobile-reopen-request/71117/2)
- [Removal of AngularJS support](https://grafana.com/blog/removal-of-angularjs-support-in-grafana-what-you-need-to-know/)
- [Grafana 13.1 release](https://grafana.com/blog/grafana-13-1-release-all-the-latest-features)
