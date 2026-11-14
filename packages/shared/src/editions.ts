/*
 * Paarvix — See your data clearly.
 * Copyright (C) 2026 Kannan / KannanTech (kannantech.com)
 * Licensed under the GNU Affero General Public License v3.0. See LICENSE.
 * Commercial licenses: support@kannantech.com
 */

/**
 * Which edition each feature belongs to. This is the one list; the API checks it and the web app shows it.
 *
 * The rule (founder decision, 2026-11-14):
 * - Community: what a person or team needs to get answers from their data. Complete, never crippled.
 * - Pro: what an organisation needs once it relies on Paarvix daily: automation, accountability, its own brand.
 * - Enterprise: what IT, security and compliance need at scale.
 *
 * A Community feature is free forever. Never move one to Pro or Enterprise; the Community list may only grow.
 * Everything not listed here (connectors, panels, dashboards, queries, viewer, alerts by email, sessions,
 * Google sign-in, PWA, bring-your-own-key AI, plugin SDK, CLI) is Community and needs no gate at all.
 */
export type Edition = 'community' | 'pro' | 'enterprise';

/** A licence for an edition includes everything in the editions below it. */
export const EDITION_RANK: Record<Edition, number> = { community: 0, pro: 1, enterprise: 2 };

export interface FeatureInfo {
  edition: Edition;
  label: string;
  /** False while the feature is planned but not built, so screens can say "coming". */
  built: boolean;
}

export const FEATURES = {
  // Community: free forever.
  'roles.custom': { edition: 'community', label: 'Create and edit custom roles', built: true },
  'datasources.access': { edition: 'community', label: 'Per-data-source access by role', built: true },
  'theme.custom': { edition: 'community', label: 'Your logo, colours and organisation name', built: true },
  'rows.rules': { edition: 'community', label: 'Row rules: each person sees only their own rows', built: true },

  // Pro.
  'reports.scheduled': { edition: 'pro', label: 'Scheduled PDF and Excel reports by email', built: false },
  'alerts.channels': { edition: 'pro', label: 'Alerts on WhatsApp, Telegram, Slack, Teams and SMS', built: false },
  'audit.log': { edition: 'pro', label: 'Audit log of who changed and viewed what', built: false },
  'dashboards.versions': { edition: 'pro', label: 'Dashboard version history and restore', built: false },
  'brand.whitelabel': { edition: 'pro', label: 'Full white-label: no Paarvix name, your own domain and email', built: false },
  'templates.premium': { edition: 'pro', label: 'Premium template packs', built: false },
  'ai.insights': { edition: 'pro', label: 'AI insights, anomaly detection and forecasts', built: false },
  'security.columns': { edition: 'pro', label: 'Column hiding, and row rules looked up from a table', built: false },

  // Enterprise.
  'auth.saml': { edition: 'enterprise', label: 'SAML single sign-on', built: false },
  'auth.scim': { edition: 'enterprise', label: 'SCIM user provisioning', built: false },
  'auth.ldap': { edition: 'enterprise', label: 'LDAP and Active Directory', built: false },
  'tenancy.multi': { edition: 'enterprise', label: 'Multiple organisations on one install', built: false },
  'embed.sdk': { edition: 'enterprise', label: 'Embed dashboards in your own product', built: false },
  'audit.siem': { edition: 'enterprise', label: 'Send the audit log to your SIEM', built: false },
  'governance.lineage': { edition: 'enterprise', label: 'Data lineage and catalogue', built: false },
  'deploy.ha': { edition: 'enterprise', label: 'High-availability cluster', built: false },
} as const satisfies Record<string, FeatureInfo>;

export type Feature = keyof typeof FEATURES;
export const ALL_FEATURES = Object.keys(FEATURES) as Feature[];

/** What a licence says, once its signature has been checked. Matches the brief, section 9.1. */
export interface LicensePayload {
  id: string;
  customer: string;
  edition: Exclude<Edition, 'community'>;
  /** Extra features beyond the edition, for one-off deals. */
  features?: Feature[];
  limits?: { users?: number; tenants?: number; aiCredits?: number };
  /** When set, the licence works only on the install with this id. */
  instanceId?: string;
  /** ISO dates. */
  issuedAt: string;
  expiresAt: string;
}

/**
 * - community: no licence. Every Community feature works.
 * - active: licence valid.
 * - grace: expired less than GRACE_DAYS ago. Paid features still work, with a warning.
 * - expired: paid features off. Nothing else changes, and no data is ever locked.
 * - invalid: signature, format or install id wrong. Treated as Community.
 */
export type LicenseState = 'community' | 'active' | 'grace' | 'expired' | 'invalid';

export const LICENSE_GRACE_DAYS = 30;
/** Admins are warned this many days before a licence expires. */
export const LICENSE_WARN_DAYS = 30;

export interface LicenseStatus {
  state: LicenseState;
  /** The edition actually in force now: community unless the licence is active or in grace. */
  edition: Edition;
  customer?: string;
  licenseId?: string;
  licensedEdition?: Exclude<Edition, 'community'>;
  expiresAt?: string;
  graceEndsAt?: string;
  /** Days until expiry; negative once expired. */
  daysLeft?: number;
  limits?: LicensePayload['limits'];
  /** Why a licence was refused, in words an admin can act on. */
  problem?: string;
  /** This install's id, to send when buying a licence bound to one server. */
  instanceId: string;
  /** Licence set through PAARVIX_LICENSE: it cannot be changed from the screen. */
  fromEnvironment: boolean;
}

/** True when a feature works under the given edition and extra licensed features. */
export function featureAllowed(feature: Feature, edition: Edition, extra: readonly string[] = []): boolean {
  const need = FEATURES[feature].edition;
  return need === 'community' || EDITION_RANK[edition] >= EDITION_RANK[need] || extra.includes(feature);
}
