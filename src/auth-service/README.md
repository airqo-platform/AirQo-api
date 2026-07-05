# Authentication Service

[![Code Coverage](https://github.com/airqo-platform/AirQo-api/actions/workflows/codecov.yml/badge.svg)](https://github.com/airqo-platform/AirQo-api/actions/workflows/codecov.yml)
[![codecov](https://codecov.io/gh/airqo-platform/AirQo-api/branch/staging/graph/badge.svg)](https://codecov.io/gh/airqo-platform/AirQo-api)
[![Passing Tests](https://img.shields.io/badge/tests%20passing-1286%20%E2%80%94%2099.4%25-brightgreen)](#testing)
[![Failing Tests](https://img.shields.io/badge/tests%20failing-8%20%E2%80%94%200.6%25-yellow)](#testing)

This microservice handles all authentication and authorization for the AirQo platform. It manages users, roles, groups, organizations, tokens, OAuth flows, and access control.

## Features

- **User Management**: Registration, login, profile updates, password reset, and account deletion.
- **Token-based Auth**: JWT tokens issued on login; use `Authorization: JWT <token>` on all protected endpoints.
- **Token Refresh**: Tokens near expiry are silently refreshed; the new token is returned in the `X-Access-Token` response header.
- **OAuth 2.0**: Google OAuth login and authorization-code flow for third-party clients.
- **Role-based Access Control (RBAC)**: Fine-grained permissions scoped to networks, groups, and organizations.
- **Multi-tenant Support**: All data is tenant-scoped; the active tenant is `airqo`.
- **API Clients**: Create and manage OAuth clients with scoped API access.
- **Favorites & Search History**: Per-user favorites and search history synced with Firebase.
- **Notification Preferences**: Per-user notification settings.
- **Candidate & Inquiry Flows**: User onboarding and support inquiry management.
- **Billing & Transactions**: API usage tracking and transaction records.
- **Firebase Integration**: User lookup and authentication via Firebase Admin SDK.
- **Mailchimp Integration**: Newsletter subscription management.

## Folder Structure

```text
src/auth-service/
├── bin/
│   ├── index.js          # Entry point
│   ├── server.js         # Express app & HTTP server
│   └── jobs/             # Background jobs (Kafka consumer, cron)
├── config/               # Database, constants, log4js, Mailchimp, Redis
├── controllers/          # Route handlers (thin; delegate to utils)
├── middleware/           # Passport JWT, headers, rate-limiting, validators
├── models/               # Mongoose schemas + per-tenant model factories
├── routes/
│   ├── v2/               # Main API surface (production)
│   └── v3/               # Groups, networks, org-requests (newer endpoints)
├── utils/                # Business logic (one file per domain)
│   ├── common/           # Shared helpers (mailer, generateFilter, stringify)
│   └── shared/           # Cross-service utilities (errors, logging)
└── validators/           # express-validator middleware chains
```

## API Versions

| Version | Base Path  | Status |
|---------|------------|--------|
| v2      | `/api/v2`  | Active |
| v3      | `/api/v3/users`  | Active (users, groups, networks, org-requests) |

Both versions expose a `/health` endpoint and a `/routes` introspection endpoint.

## Authentication

All protected endpoints require:

```http
Authorization: JWT <token>
```

> **Note:** `Bearer` tokens are rejected. Only `JWT` prefix is accepted.

Tokens near expiry are automatically refreshed. Check the `X-Access-Token` response header for the renewed token.

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm
- MongoDB (configure `DB_URL` in your environment file)
- Redis (configure `REDIS_SERVER` and `REDIS_PORT`)
- Firebase Admin credentials
- Mailchimp API key (optional, for newsletter features)

### Installation

```bash
git clone https://github.com/airqo-platform/AirQo-api.git
cd src/auth-service
npm install
```

### Running Locally

```bash
cp .env.development.template.json .env.development.json
# Fill in the required values
npm run dev
```

The server listens on port `3000` by default (override with the `PORT` environment variable).

### Running with Docker

```bash
docker build -t auth-service .
docker run -d -p 3000:3000 -e NODE_ENV=production auth-service
```

## Testing

```bash
npm test
```

Tests use Mocha + nyc (Istanbul). Coverage reports are uploaded to Codecov on every push.

**Last recorded test run:**

| Result | Count | Percentage |
|---|---|---|
| ✅ Passing | 1286 | 99.4% |
| ❌ Failing | 8 | 0.6% |
| ⏭ Pending | 88 | — |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
