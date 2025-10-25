# Quick Reference: Missing Environment Variables Setup Guide

## How to Set Each Missing Variable

---

## Global Variables

### JWT Configuration
```bash
# Token lifetime in seconds (e.g., 24 hours = 86400 seconds)
JWT_EXPIRES_IN_SECONDS=86400

# Time window before expiry when token can be refreshed (e.g., 1 hour = 3600 seconds)
JWT_REFRESH_WINDOW_SECONDS=3600

# Grace period after expiry for token validation (e.g., 5 minutes = 300 seconds)
JWT_GRACE_PERIOD_SECONDS=300
```

### Security & Access Control
```bash
# Comma-separated list of super admin emails
SUPER_ADMIN_EMAIL_ALLOWLIST=admin@airqo.net,superadmin@airqo.net

# Comma-separated list of IP addresses or CIDR blocks to whitelist from rate limiting
RATE_LIMIT_WHITELIST=192.168.1.0/24,10.0.0.1
```

### Application Environment
```bash
# Set to: development, staging, or production
NODE_ENV=production
```

### Firebase Integration
```bash
# URL to redirect users after successful email verification
FIREBASE_VERIFICATION_SUCCESS_REDIRECT=https://analytics.airqo.net/verify-success
```

---

## Development Environment

### Kafka Configuration
```bash
# Comma-separated list of Kafka topics for development
KAFKA_TOPICS_DEV=airqo-dev-events,airqo-dev-measurements,airqo-dev-notifications

# URL of the schema registry for development
SCHEMA_REGISTRY_DEV=http://localhost:8081

# Specific topic for raw measurements in development
KAFKA_RAW_MEASUREMENTS_TOPICS_DEV=airqo-raw-measurements-dev
```

---

## Staging Environment

### Kafka Configuration
```bash
# Comma-separated list of Kafka topics for staging
KAFKA_TOPICS_STAGE=airqo-stage-events,airqo-stage-measurements,airqo-stage-notifications

# URL of the schema registry for staging
SCHEMA_REGISTRY_STAGE=http://staging-schema-registry.airqo.net:8081

# Specific topic for raw measurements in staging
KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE=airqo-raw-measurements-stage
```

---

## Production Environment

### MongoDB Configuration
```bash
# Database name for production (fallback value)
MONGO_PROD=auth_prod
```

### Platform URLs
```bash
# Base URL for production platform (used for password reset, login, forgot password)
PLATFORM_PRODUCTION_BASE_URL=https://platform.airqo.net
```

### Kafka Configuration
```bash
# Comma-separated list of Kafka topics for production
KAFKA_TOPICS_PROD=airqo-prod-events,airqo-prod-measurements,airqo-prod-notifications

# URL of the schema registry for production
SCHEMA_REGISTRY_PROD=https://schema-registry.airqo.net:8081

# Specific topic for raw measurements in production
KAFKA_RAW_MEASUREMENTS_TOPICS_PROD=airqo-raw-measurements-prod
```

---

## Example Complete Configuration by Environment

### Development Example
```bash
# Global
NODE_ENV=development
JWT_EXPIRES_IN_SECONDS=86400
JWT_REFRESH_WINDOW_SECONDS=3600
JWT_GRACE_PERIOD_SECONDS=300
SUPER_ADMIN_EMAIL_ALLOWLIST=dev-admin@airqo.net
RATE_LIMIT_WHITELIST=127.0.0.1,localhost
FIREBASE_VERIFICATION_SUCCESS_REDIRECT=http://localhost:3000/verify-success

# Development
KAFKA_TOPICS_DEV=dev-events,dev-measurements
SCHEMA_REGISTRY_DEV=http://localhost:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_DEV=raw-measurements-dev
```

### Staging Example
```bash
# Global
NODE_ENV=staging
JWT_EXPIRES_IN_SECONDS=86400
JWT_REFRESH_WINDOW_SECONDS=3600
JWT_GRACE_PERIOD_SECONDS=300
SUPER_ADMIN_EMAIL_ALLOWLIST=staging-admin@airqo.net,admin@airqo.net
RATE_LIMIT_WHITELIST=10.0.0.0/24
FIREBASE_VERIFICATION_SUCCESS_REDIRECT=https://staging-analytics.airqo.net/verify-success

# Staging
KAFKA_TOPICS_STAGE=stage-events,stage-measurements,stage-notifications
SCHEMA_REGISTRY_STAGE=http://staging-schema-registry:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE=raw-measurements-stage
```

### Production Example
```bash
# Global
NODE_ENV=production
JWT_EXPIRES_IN_SECONDS=86400
JWT_REFRESH_WINDOW_SECONDS=3600
JWT_GRACE_PERIOD_SECONDS=300
SUPER_ADMIN_EMAIL_ALLOWLIST=admin@airqo.net,superadmin@airqo.net
RATE_LIMIT_WHITELIST=52.45.23.1,54.23.45.67
FIREBASE_VERIFICATION_SUCCESS_REDIRECT=https://analytics.airqo.net/verify-success

# Production
MONGO_PROD=auth_prod
PLATFORM_PRODUCTION_BASE_URL=https://platform.airqo.net
KAFKA_TOPICS_PROD=prod-events,prod-measurements,prod-notifications,prod-alerts
SCHEMA_REGISTRY_PROD=https://schema-registry.airqo.net:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_PROD=raw-measurements-prod
```

---

## Security Best Practices

### 1. JWT Configuration
- **JWT_EXPIRES_IN_SECONDS:** Shorter is more secure (e.g., 1-24 hours)
- **JWT_REFRESH_WINDOW_SECONDS:** Should be less than expiry time
- **JWT_GRACE_PERIOD_SECONDS:** Keep minimal (5-10 minutes max)

### 2. Super Admin Email Allowlist
- Only add verified, trusted email addresses
- Use work emails, not personal emails
- Keep the list as small as possible
- Document who has super admin access

### 3. Rate Limit Whitelist
- Only whitelist IPs that truly need exemption (e.g., monitoring services)
- Use CIDR notation for IP ranges
- Regularly review and remove unused entries
- Log all whitelisted access for auditing

### 4. URLs and Endpoints
- Always use HTTPS in production
- Verify SSL certificates are valid
- Use environment-appropriate domains
- Avoid hardcoding IPs

---

## Troubleshooting

### Issue: JWT tokens not working
**Check:**
- JWT_EXPIRES_IN_SECONDS is set
- JWT_SECRET is properly configured
- JWT_REFRESH_WINDOW_SECONDS < JWT_EXPIRES_IN_SECONDS

### Issue: Super admin access denied
**Check:**
- Email is in SUPER_ADMIN_EMAIL_ALLOWLIST
- No extra spaces in the comma-separated list
- Email matches exactly (case-sensitive)

### Issue: Kafka connection failures
**Check:**
- KAFKA_TOPICS_* is set with valid topic names
- SCHEMA_REGISTRY_* URLs are accessible
- KAFKA_BOOTSTRAP_SERVERS_* is properly configured
- Network connectivity to Kafka brokers

### Issue: Rate limiting not working correctly
**Check:**
- RATE_LIMIT_WHITELIST format is correct (IP or CIDR)
- No trailing commas in the list
- IPs are publicly routable (if whitelisting external IPs)

---

## Testing Checklist

After adding these variables:

1. **JWT Functionality**
   - [ ] Users can log in successfully
   - [ ] Tokens expire as expected
   - [ ] Token refresh works within the window
   - [ ] Expired tokens are rejected after grace period

2. **Super Admin Access**
   - [ ] Super admins can access admin features
   - [ ] Non-whitelisted admins are denied
   - [ ] Audit logs show super admin actions

3. **Kafka Integration**
   - [ ] Messages publish to topics successfully
   - [ ] Schema validation works
   - [ ] Consumer receives messages

4. **Rate Limiting**
   - [ ] Normal users are rate-limited
   - [ ] Whitelisted IPs bypass rate limits
   - [ ] Rate limit metrics are tracked

5. **Firebase Integration**
   - [ ] Email verification redirects work
   - [ ] Users land on correct page after verification

---

## Migration Steps

### Phase 1: Add to Development
1. Add all missing variables to development environment
2. Test thoroughly
3. Monitor logs for any issues
4. Fix any problems found

### Phase 2: Add to Staging
1. Apply same configuration to staging
2. Run integration tests
3. Load test if possible
4. Verify monitoring and alerting

### Phase 3: Deploy to Production
1. Schedule maintenance window (if needed)
2. Add variables to production
3. Deploy configuration
4. Monitor closely for first 24 hours
5. Validate all critical flows

---

## Questions?

If you need help with any specific variable:
1. Check the code reference in the main analysis report
2. Review your existing similar variables for patterns
3. Consult with your DevOps/Infrastructure team
4. Test in development first

**Remember:** Never commit `.env` files with real secrets to version control!
