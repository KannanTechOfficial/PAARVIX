# Security Policy — Paarvix

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | ✅        |
| Older   | ❌        |

## Reporting a Vulnerability

**Please do NOT open a public issue for security vulnerabilities.**

Instead, email **security@kannantech.com** with:

1. Description of the vulnerability
2. Steps to reproduce
3. Impact assessment
4. Suggested fix (if any)

We will acknowledge receipt within **48 hours** and aim to release a fix within **7 days** for critical issues.

## Security Practices

- All credentials encrypted at rest (AES-256-GCM)
- Argon2id password hashing
- Short-lived JWT tokens with httpOnly refresh cookies
- Input validation on all endpoints (class-validator + Zod)
- OWASP ASVS Level 2 target
- Dependency scanning (npm audit, Dependabot)
- Secret scanning in CI
- Read-only database enforcement for user queries

## Bug Bounty

We do not currently offer a formal bug bounty program, but we gratefully acknowledge responsible disclosures in our release notes (with permission).

## Contact

**Email:** security@kannantech.com

© 2026 Kannan / KannanTech. All rights reserved.
