# Environment-Specific Template Files

This directory contains environment-specific `.env` template files for the AirQo authentication service.

## Available Templates

### 1. `.env.production.template`
Complete environment configuration for **Production** deployment.
- Contains: Global variables + Production-specific variables
- NODE_ENV: production
- Use for: Live production environment

### 2. `.env.staging.template`
Complete environment configuration for **Staging** deployment.
- Contains: Global variables + Staging-specific variables
- NODE_ENV: staging
- Use for: Pre-production testing and validation

### 3. `.env.development.template`
Complete environment configuration for **Development** deployment.
- Contains: Global variables + Development-specific variables
- NODE_ENV: development
- Use for: Local development and testing

### 4. `.env.template.complete`
Master template with **ALL** environments in a single file.
- Contains: Global + Development + Staging + Production variables
- Use for: Reference or multi-environment setup

## How to Use

### For Each Environment Separately

1. **Choose the appropriate template for your environment:**
   - Production: Use `.env.production.template`
   - Staging: Use `.env.staging.template`
   - Development: Use `.env.development.template`

2. **Copy the template to create your `.env` file:**
   ```bash
   # For Production
   cp .env.production.template .env
   
   # For Staging
   cp .env.staging.template .env
   
   # For Development
   cp .env.development.template .env
   ```

3. **Fill in the values** for each variable based on your environment

4. **Never commit** the actual `.env` file to version control

### For Multi-Environment Setup

If you manage multiple environments in one location:

```bash
# Production
cp .env.production.template .env.production
# Fill in production values

# Staging
cp .env.staging.template .env.staging
# Fill in staging values

# Development
cp .env.development.template .env.development
# Fill in development values
```

Then use environment-specific loading:
```bash
# Load specific environment
NODE_ENV=production node app.js  # Uses .env.production
NODE_ENV=staging node app.js     # Uses .env.staging
NODE_ENV=development node app.js # Uses .env.development
```

## Template Structure

Each environment-specific template contains:

### Global Configuration Section
Variables shared across all environments:
- Basic Application Information
- Authentication & Security
- Database Configuration (Global)
- Email Configuration
- Team Email Groups
- Firebase Configuration
- Google Integration
- Slack Integration
- Mobile App Configuration
- Social Media Accounts
- GroupDocs Integration
- Messaging & Topics
- Message Broker General Settings
- Payment Processing
- Health Checks & Rate Limiting
- Organisation Onboarding (Global)

### Environment-Specific Section
Variables unique to that environment:
- MongoDB Configuration (environment-specific)
- Platform URLs
- Default Entities
- Kafka Configuration
- Redis Configuration
- Authentication & API tokens
- Presto Database
- RabbitMQ Configuration
- Message Broker Settings
- Paddle Payment Integration
- Security & Rate Limiting
- Organisation Onboarding URLs

## Key Differences Between Environments

### Variable Prefixes
- **Development:** `DEV_*` prefix (e.g., `DEV_API_TOKEN`)
- **Staging:** `STAGE_*` prefix (e.g., `STAGE_API_TOKEN`)
- **Production:** `PROD_*` prefix (e.g., `PROD_API_TOKEN`)

### NODE_ENV Values
- Production: `NODE_ENV=production`
- Staging: `NODE_ENV=staging`
- Development: `NODE_ENV=development`

### Database Names
- Production: `MONGO_PROD_URI`, `DB_NAME_PROD`
- Staging: `MONGO_STAGE_URI`, `DB_NAME_STAGING`
- Development: `MONGO_DEV_URI`

### Platform URLs
- Production: `PLATFORM_PRODUCTION_BASE_URL`, `ANALYTICS_PRODUCTION_BASE_URL`
- Staging: `PLATFORM_STAGING_BASE_URL`, `ANALYTICS_STAGING_BASE_URL`
- Development: `PLATFORM_DEV_BASE_URL`, `ANALYTICS_DEV_BASE_URL`

## Security Best Practices

### ✅ DO:
- Keep `.env` files out of version control (add to `.gitignore`)
- Use different values for each environment
- Store production secrets in a secure vault (AWS Secrets Manager, Azure Key Vault, etc.)
- Rotate secrets regularly
- Use strong, unique passwords for each environment
- Limit access to production environment variables

### ❌ DON'T:
- Commit `.env` files with real values to Git
- Share production credentials via email or chat
- Use the same passwords across environments
- Store secrets in plain text in multiple locations
- Give developers access to production secrets unless necessary

## Environment Variable Priority

When using multiple `.env` files, the typical loading order is:
1. `.env.{environment}.local` (highest priority, git-ignored)
2. `.env.{environment}`
3. `.env.local` (git-ignored)
4. `.env`

## Validation Checklist

Before deploying to any environment, ensure:

### Global Variables
- [ ] All JWT-related variables are set
- [ ] Email configuration is complete and tested
- [ ] Firebase credentials are valid
- [ ] Google OAuth credentials are configured
- [ ] Slack integration is set up (if using)
- [ ] Payment processing (Paddle) is configured

### Environment-Specific Variables
- [ ] MongoDB connection strings are correct
- [ ] Platform URLs are accessible
- [ ] Kafka topics and schema registry are configured
- [ ] Redis connection is working
- [ ] API tokens are generated and valid
- [ ] RabbitMQ connection is configured (if using)
- [ ] reCAPTCHA keys are valid for the domain
- [ ] Admin setup secret is secure

## Troubleshooting

### Issue: Variables not loading
**Solution:**
1. Check file name matches exactly (`.env`, `.env.production`, etc.)
2. Ensure file is in the correct directory
3. Verify NODE_ENV matches the environment file
4. Check for syntax errors (no spaces around `=`)

### Issue: MongoDB connection failed
**Solution:**
1. Verify `MONGO_*_URI` is correct
2. Check network connectivity
3. Ensure database user has proper permissions
4. Validate connection string format

### Issue: JWT tokens not working
**Solution:**
1. Confirm `JWT_SECRET` is set
2. Verify `JWT_EXPIRES_IN_SECONDS` is a number
3. Check `JWT_REFRESH_WINDOW_SECONDS` < `JWT_EXPIRES_IN_SECONDS`

### Issue: Kafka connection errors
**Solution:**
1. Verify `KAFKA_BOOTSTRAP_SERVERS_*` is accessible
2. Check `KAFKA_TOPICS_*` exist
3. Ensure `SCHEMA_REGISTRY_*` is reachable
4. Validate network connectivity to Kafka cluster

## Migration from Old Template

If you're migrating from the old single template:

1. **Identify your environment** (production, staging, or development)
2. **Use the appropriate new template** from this directory
3. **Copy over your existing values** to the new template
4. **Add the 18 missing variables** identified in the analysis report
5. **Test thoroughly** in development first
6. **Deploy to staging** for validation
7. **Update production** during a maintenance window

## Additional Resources

- **ANALYSIS_REPORT.md** - Detailed analysis of missing variables
- **SETUP_GUIDE.md** - Quick reference for setting up variables
- **Configuration Files** - See `src/auth-service/config/environments/`

## Support

For questions or issues with environment configuration:
1. Review the ANALYSIS_REPORT.md for detailed information
2. Check the SETUP_GUIDE.md for example values
3. Consult the code in `src/auth-service/config/environments/`
4. Contact your DevOps/Infrastructure team

---

**Last Updated:** October 25, 2025  
**Templates Generated From:** Code analysis of all configuration files  
**Total Variables:** 285+ (varies by environment)
