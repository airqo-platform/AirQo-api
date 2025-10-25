# Environment Templates Comparison Chart

## Quick Reference Guide

| Feature | Development | Staging | Production |
|---------|------------|---------|------------|
| **File Name** | `.env.development.template` | `.env.staging.template` | `.env.production.template` |
| **NODE_ENV** | `development` | `staging` | `production` |
| **Variable Prefix** | `DEV_*` | `STAGE_*` | `PROD_*` |
| **Total Variables** | ~230 | ~234 | ~234 |
| **Purpose** | Local development & testing | Pre-production validation | Live production environment |

---

## Variable Categories Breakdown

### Global Variables (Shared Across All Environments)
✅ Included in all three templates

| Category | Count | Examples |
|----------|-------|----------|
| Basic App Info | 13 | `PORT`, `NODE_ENV`, `SUPPORT_EMAIL` |
| Authentication & Security | 14 | `JWT_SECRET`, `SESSION_SECRET`, `RATE_LIMIT_WHITELIST` |
| Database (Global) | 6 | `MONGO_GCE_URI`, `LOCAL_DB` |
| Email Configuration | 7 | `MAIL_USER`, `MAILCHIMP_API_KEY` |
| Team Email Groups | 12 | `DEVELOPERS_EMAILS`, `PLATFORM_EMAILS` |
| Firebase | 19 | `FIREBASE_API_KEY`, `FIREBASE_DATABASE_URL` |
| Google Integration | 5 | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Slack | 3 | `SLACK_TOKEN`, `SLACK_CHANNEL` |
| Mobile App | 2 | `MOBILE_APP_PACKAGE_NAME` |
| Social Media | 9 | `AIRQO_ENG_TWITTER_API_KEY` |
| GroupDocs | 5 | `GROUPDOCS_CONVERSION_CLOUD_CLIENT_ID` |
| Messaging/Topics | 6 | `DEPLOY_TOPIC`, `RECALL_TOPIC` |
| Message Broker | 6 | `MESSAGE_BROKER_PRIORITIES`, `NATS_SERVERS` |
| Payment Processing | 3 | `PADDLE_WEBHOOK_SECRET`, `PADDLE_PRODUCT_ID` |
| Health & Rate Limiting | 2 | `HEALTH_CHECK_RATE_LIMIT_MAX` |
| Organisation Onboarding | 4 | `DEFAULT_USE_ONBOARDING_FLOW` |

**Total Global Variables:** ~116

---

## Environment-Specific Variables Comparison

### MongoDB Configuration

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| Database Name | `MONGO_DEV` | `MONGO_STAGE` | `MONGO_PROD` |
| Connection URI | `MONGO_DEV_URI` | `MONGO_STAGE_URI` | `MONGO_PROD_URI` |
| Command URI | `COMMAND_MONGO_DEV_URI` | `COMMAND_MONGO_STAGE_URI` | `COMMAND_MONGO_PROD_URI` |
| Query URI | `QUERY_MONGO_DEV_URI` | `QUERY_MONGO_STAGE_URI` | `QUERY_MONGO_PROD_URI` |
| DB Name (Alt) | - | `DB_NAME_STAGING` | `DB_NAME_PROD` |

### Platform URLs

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| Platform Base | `PLATFORM_DEV_BASE_URL` | `PLATFORM_STAGING_BASE_URL` | `PLATFORM_PRODUCTION_BASE_URL` |
| Analytics Base | `ANALYTICS_DEV_BASE_URL` | `ANALYTICS_STAGING_BASE_URL` | `ANALYTICS_PRODUCTION_BASE_URL` |
| Selected Sites | `SELECTED_SITES_DEVELOPMENT` | `SELECTED_SITES_STAGING` | `SELECTED_SITES_PRODUCTION` |

**Example Values:**
- Development: `http://localhost:3000`
- Staging: `https://staging-platform.airqo.net`
- Production: `https://platform.airqo.net`

### Kafka Configuration

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| Bootstrap Servers | `KAFKA_BOOTSTRAP_SERVERS_DEV` | `KAFKA_BOOTSTRAP_SERVERS_STAGE` | `KAFKA_BOOTSTRAP_SERVERS_PROD` |
| Topics | `KAFKA_TOPICS_DEV` | `KAFKA_TOPICS_STAGE` | `KAFKA_TOPICS_PROD` |
| Schema Registry | `SCHEMA_REGISTRY_DEV` | `SCHEMA_REGISTRY_STAGE` | `SCHEMA_REGISTRY_PROD` |
| Raw Measurements | `KAFKA_RAW_MEASUREMENTS_TOPICS_DEV` | `KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE` | `KAFKA_RAW_MEASUREMENTS_TOPICS_PROD` |
| Client ID | `KAFKA_CLIENT_ID_DEV` | `KAFKA_CLIENT_ID_STAGE` | `KAFKA_CLIENT_ID_PROD` |
| Client Group | `KAFKA_CLIENT_GROUP_DEV` | `KAFKA_CLIENT_GROUP_STAGE` | `KAFKA_CLIENT_GROUP_PROD` |

### Redis Configuration

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| Server | `DEV_REDIS_SERVER` | `STAGE_REDIS_SERVER` | `PROD_REDIS_SERVER` |
| Host | `DEV_REDIS_HOST` | `STAGE_REDIS_HOST` | `PROD_REDIS_HOST` |
| Port | `DEV_REDIS_PORT` | `STAGE_REDIS_PORT` | `PROD_REDIS_PORT` |
| Password | `DEV_REDIS_PASSWORD` | `STAGE_REDIS_PASSWORD` | `PROD_REDIS_PASSWORD` |
| Database | `DEV_REDIS_DB` | `STAGE_REDIS_DB` | `PROD_REDIS_DB` |

### Security & API

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| API Token | `DEV_API_TOKEN` | `STAGE_API_TOKEN` | `PROD_API_TOKEN` |
| Internal API Key | `DEV_INTERNAL_API_KEY` | `STAGE_INTERNAL_API_KEY` | `PROD_INTERNAL_API_KEY` |
| reCAPTCHA Site Key | `DEV_RECAPTCHA_SITE_KEY` | `STAGE_RECAPTCHA_SITE_KEY` | `PROD_RECAPTCHA_SITE_KEY` |
| reCAPTCHA Secret | `DEV_RECAPTCHA_SECRET_KEY` | `STAGE_RECAPTCHA_SECRET_KEY` | `PROD_RECAPTCHA_SECRET_KEY` |
| Bypass Captcha | `DEV_BYPASS_CAPTCHA` | `STAGE_BYPASS_CAPTCHA` | `PROD_BYPASS_CAPTCHA` |
| Bypass Rate Limit | `DEV_BYPASS_RATE_LIMIT` | `STAGE_BYPASS_RATE_LIMIT` | `PROD_BYPASS_RATE_LIMIT` |
| Admin Setup Secret | `DEV_ADMIN_SETUP_SECRET` | `STAGE_ADMIN_SETUP_SECRET` | `PROD_ADMIN_SETUP_SECRET` |

### Default Entities

| Variable | Development | Staging | Production |
|----------|------------|---------|------------|
| Network | `DEV_DEFAULT_NETWORK` | `STAGE_DEFAULT_NETWORK` | `PROD_DEFAULT_NETWORK` |
| Network Role | `DEV_DEFAULT_NETWORK_ROLE` | `STAGE_DEFAULT_NETWORK_ROLE` | `PROD_DEFAULT_NETWORK_ROLE` |
| Group | `DEV_DEFAULT_GROUP` | `STAGE_DEFAULT_GROUP` | `PROD_DEFAULT_GROUP` |
| Group Role | `DEV_DEFAULT_GROUP_ROLE` | `STAGE_DEFAULT_GROUP_ROLE` | `PROD_DEFAULT_GROUP_ROLE` |
| AirQLoud | `DEV_DEFAULT_AIRQLOUD` | `STAGE_DEFAULT_AIRQLOUD` | `PROD_DEFAULT_AIRQLOUD` |
| Grid | `DEV_DEFAULT_GRID` | `STAGE_DEFAULT_GRID` | `PROD_DEFAULT_GRID` |
| Cohort | `DEV_DEFAULT_COHORT` | `STAGE_DEFAULT_COHORT` | `PROD_DEFAULT_COHORT` |

---

## Additional Environment-Specific Features

### Development Only
- `DEVELOPMENT_DEFAULT_NETWORK` - Extra network configuration for dev

### Staging & Production Only
- `NEXT_PUBLIC_GRIDS` - Next.js public grid configuration
- `NEXT_PUBLIC_DEFAULT_CHART_SITES` - Public chart site configuration
- `DB_NAME_STAGING` / `DB_NAME_PROD` - Explicit database names

---

## Variable Counts by Category

| Category | Development | Staging | Production |
|----------|-------------|---------|------------|
| **Global Variables** | 116 | 116 | 116 |
| **MongoDB Config** | 4 | 5 | 5 |
| **Platform URLs** | 3 | 3 | 3 |
| **Default Entities** | 9 | 8 | 8 |
| **Kafka Config** | 10 | 10 | 10 |
| **Redis Config** | 5 | 5 | 5 |
| **Auth & API** | 2 | 2 | 2 |
| **Presto Database** | 7 | 7 | 7 |
| **RabbitMQ** | 5 | 5 | 5 |
| **Message Broker** | 3 | 3 | 3 |
| **Paddle Payment** | 6 | 6 | 6 |
| **Security** | 7 | 7 | 7 |
| **Next.js Public** | 0 | 2 | 2 |
| **Onboarding** | 1 | 1 | 1 |
| **TOTAL** | ~228 | ~234 | ~234 |

---

## Usage Recommendations

### When to Use Each Template

#### Development Template
✅ **Use for:**
- Local development on your machine
- Unit testing and integration testing
- Rapid prototyping
- Feature development

❌ **Don't use for:**
- Testing with real user data
- Load testing
- Production-like scenarios
- External integrations testing

#### Staging Template
✅ **Use for:**
- Pre-production validation
- Integration testing with external services
- Load and performance testing
- UAT (User Acceptance Testing)
- Demo environments

❌ **Don't use for:**
- Day-to-day development
- Production traffic
- Real customer data processing

#### Production Template
✅ **Use for:**
- Live production environment only
- Serving real users
- Processing actual customer data
- Business-critical operations

❌ **Don't use for:**
- Development or testing
- Experiments
- Unvalidated code
- Learning/training purposes

---

## Security Levels by Environment

| Security Aspect | Development | Staging | Production |
|----------------|-------------|---------|------------|
| **Captcha** | Often bypassed | Enabled | Always enabled |
| **Rate Limiting** | Relaxed/bypassed | Standard | Strict |
| **SSL/TLS** | Optional | Required | Required |
| **Secrets Management** | Local files | Vault/KMS | Vault/KMS |
| **Access Control** | Permissive | Restrictive | Very restrictive |
| **Monitoring** | Basic | Standard | Comprehensive |
| **Backup Frequency** | None/weekly | Daily | Hourly/continuous |
| **Audit Logging** | Minimal | Standard | Comprehensive |

---

## Configuration Checklist

### Before Using Any Template:

#### Development
- [ ] Set `NODE_ENV=development`
- [ ] Configure local database
- [ ] Use development API keys (non-production)
- [ ] Set up local Kafka (or use dev cluster)
- [ ] Configure localhost URLs
- [ ] Disable rate limiting (optional)
- [ ] Use test email accounts
- [ ] Enable debug logging

#### Staging
- [ ] Set `NODE_ENV=staging`
- [ ] Use staging database (isolated from prod)
- [ ] Configure staging URLs
- [ ] Use staging API keys
- [ ] Enable rate limiting
- [ ] Set up monitoring
- [ ] Configure staging Kafka cluster
- [ ] Use staging email accounts
- [ ] Enable audit logging

#### Production
- [ ] Set `NODE_ENV=production`
- [ ] Use production database with backups
- [ ] Configure production URLs (HTTPS)
- [ ] Use production API keys (rotate regularly)
- [ ] Enable all security features
- [ ] Set up comprehensive monitoring
- [ ] Configure production Kafka cluster
- [ ] Use production email accounts
- [ ] Enable full audit logging
- [ ] Set up alerting
- [ ] Configure auto-scaling
- [ ] Enable disaster recovery

---

## Common Configuration Patterns

### Database Connection Strings
```bash
# Development
mongodb://localhost:27017/auth_dev

# Staging
mongodb://staging-mongo.internal:27017/auth_staging?replicaSet=rs0

# Production
mongodb+srv://prod-cluster.mongodb.net/auth_prod?retryWrites=true&w=majority
```

### Platform URLs
```bash
# Development
http://localhost:3000

# Staging
https://staging-platform.airqo.net

# Production
https://platform.airqo.net
```

### Kafka Topics
```bash
# Development
dev-events,dev-measurements

# Staging
staging-events,staging-measurements,staging-alerts

# Production
prod-events,prod-measurements,prod-alerts,prod-critical
```

---

**Need Help?**
- See `README_TEMPLATES.md` for detailed usage instructions
- Check `SETUP_GUIDE.md` for example values
- Review `ANALYSIS_REPORT.md` for missing variables analysis
