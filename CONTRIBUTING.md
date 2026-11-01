# Contributing to Paarvix

Thank you for your interest in contributing to Paarvix! 🎉

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/paarvix.git`
3. Install dependencies: `npm install`
4. Create a branch: `git checkout -b feat/your-feature`
5. Make your changes
6. Run tests: `npm test`
7. Commit with conventional commits: `git commit -m "feat: add new panel type"`
8. Push and open a Pull Request

## Development Setup

```bash
# Start PostgreSQL (Docker)
docker compose -f docker/docker-compose.yml up postgres -d

# Start API (dev mode)
npm run dev:api

# Start frontend (dev mode)
npm run dev:web
```

## Guidelines

- **TypeScript strict mode** — no unexplained `any`
- **Conventional Commits** — `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- **Tests required** — unit tests for logic, e2e for user flows
- **AGPL header** — every new source file must include the license header
- **i18n** — add English and Tamil strings for any user-facing text
- **Accessibility** — follow WCAG 2.2 AA guidelines

## Contributor License Agreement (CLA)

By submitting a Pull Request, you agree to the [CLA](https://cla-assistant.io/KannanTechOfficial/PAARVIX). This allows us to offer Paarvix under both AGPL and commercial licenses.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security Issues

Please do NOT open public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md).

## Questions?

- GitHub Discussions: https://github.com/KannanTechOfficial/PAARVIX/discussions
- Email: paarvix@kannantech.com

Thank you for helping make Paarvix better! 🙏
