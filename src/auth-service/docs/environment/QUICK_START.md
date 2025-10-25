# Quick Start Guide - Environment Setup

Get your environment up and running in minutes!

---

## 🚀 Quick Setup (5 Minutes)

### Step 1: Choose Your Environment

```bash
# Are you working on...
Development?  → Use .env.development.template
Staging?      → Use .env.staging.template  
Production?   → Use .env.production.template
```

### Step 2: Copy the Template

```bash
# For Development
cp .env.development.template .env

# For Staging
cp .env.staging.template .env

# For Production
cp .env.production.template .env
```

### Step 3: Fill in Critical Variables

These **18 variables are REQUIRED** and were missing from your old template:

#### Global (All Environments)
```bash
NODE_ENV=development  # or staging/production
JWT_EXPIRES_IN_SECONDS=86400
JWT_REFRESH_WINDOW_SECONDS=3600
JWT_GRACE_PERIOD_SECONDS=300
SUPER_ADMIN_EMAIL_ALLOWLIST=your-admin@airqo.net
RATE_LIMIT_WHITELIST=127.0.0.1
FIREBASE_VERIFICATION_SUCCESS_REDIRECT=http://localhost:3000/verify-success
```

#### Development Specific
```bash
KAFKA_TOPICS_DEV=dev-events,dev-measurements
SCHEMA_REGISTRY_DEV=http://localhost:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_DEV=raw-measurements-dev
```

#### Staging Specific
```bash
KAFKA_TOPICS_STAGE=stage-events,stage-measurements
SCHEMA_REGISTRY_STAGE=http://staging-schema:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE=raw-measurements-stage
```

#### Production Specific
```bash
MONGO_PROD=auth_prod
PLATFORM_PRODUCTION_BASE_URL=https://platform.airqo.net
KAFKA_TOPICS_PROD=prod-events,prod-measurements
SCHEMA_REGISTRY_PROD=https://schema-registry.airqo.net:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_PROD=raw-measurements-prod
```

### Step 4: Test Your Configuration

```bash
# Start your application
npm start

# Check logs for any missing variables
# Look for: "undefined" or "null" in configuration logs
```

---

## 🎯 Essential Variables Checklist

Mark off as you configure each one:

### Database
- [ ] `MONGO_{ENV}_URI` - Your MongoDB connection string
- [ ] Database name variables set

### Authentication  
- [ ] `JWT_SECRET` - Strong random string (min 32 chars)
- [ ] `JWT_EXPIRES_IN_SECONDS` - Token lifetime
- [ ] `SESSION_SECRET` - Strong random string

### Email
- [ ] `MAIL_USER` - SMTP username
- [ ] `MAIL_PASS` - SMTP password
- [ ] Team email addresses configured

### Firebase
- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_PRIVATE_KEY`
- [ ] `FIREBASE_CLIENT_EMAIL`
- [ ] All Firebase collection names

### Platform URLs
- [ ] `PLATFORM_{ENV}_BASE_URL`
- [ ] `ANALYTICS_{ENV}_BASE_URL`

### Kafka (if using)
- [ ] `KAFKA_BOOTSTRAP_SERVERS_{ENV}`
- [ ] `KAFKA_TOPICS_{ENV}`
- [ ] `SCHEMA_REGISTRY_{ENV}`

---

## 🔧 Environment-Specific Quick Config

### Development Environment (Copy & Paste Ready)

```bash
# NODE & APP
NODE_ENV=development
PORT=3000
DEFAULT_LIMIT=100

# JWT
JWT_SECRET=your-dev-secret-change-me-123456789
JWT_EXPIRES_IN_SECONDS=86400
JWT_REFRESH_WINDOW_SECONDS=3600
JWT_GRACE_PERIOD_SECONDS=300

# DATABASE
MONGO_DEV_URI=mongodb://localhost:27017/auth_dev
MONGO_DEV=auth_dev
COMMAND_MONGO_DEV_URI=mongodb://localhost:27017/auth_dev
QUERY_MONGO_DEV_URI=mongodb://localhost:27017/auth_dev

# URLS
PLATFORM_DEV_BASE_URL=http://localhost:3000
ANALYTICS_DEV_BASE_URL=http://localhost:5000

# KAFKA (Local)
KAFKA_BOOTSTRAP_SERVERS_DEV=localhost:9092
KAFKA_TOPICS_DEV=dev-events,dev-measurements
SCHEMA_REGISTRY_DEV=http://localhost:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_DEV=raw-measurements-dev
KAFKA_CLIENT_ID_DEV=airqo-dev-client
KAFKA_CLIENT_GROUP_DEV=airqo-dev-group

# REDIS (Local)
DEV_REDIS_SERVER=localhost
DEV_REDIS_HOST=localhost
DEV_REDIS_PORT=6379
DEV_REDIS_DB=0

# SECURITY (Relaxed for dev)
DEV_BYPASS_CAPTCHA=true
DEV_BYPASS_RATE_LIMIT=true
SUPER_ADMIN_EMAIL_ALLOWLIST=dev@airqo.net,admin@airqo.net
RATE_LIMIT_WHITELIST=127.0.0.1,localhost

# FIREBASE REDIRECT
FIREBASE_VERIFICATION_SUCCESS_REDIRECT=http://localhost:3000/verify-success
```

### Staging Environment (Template)

```bash
# NODE & APP
NODE_ENV=staging
PORT=3000

# JWT
JWT_SECRET=your-staging-secret-CHANGE-THIS
JWT_EXPIRES_IN_SECONDS=86400
JWT_REFRESH_WINDOW_SECONDS=3600
JWT_GRACE_PERIOD_SECONDS=300

# DATABASE
MONGO_STAGE_URI=mongodb://staging-db.internal:27017/auth_staging
MONGO_STAGE=auth_staging
COMMAND_MONGO_STAGE_URI=mongodb://staging-db.internal:27017/auth_staging
QUERY_MONGO_STAGE_URI=mongodb://staging-db.internal:27017/auth_staging

# URLS
PLATFORM_STAGING_BASE_URL=https://staging-platform.airqo.net
ANALYTICS_STAGING_BASE_URL=https://staging-analytics.airqo.net

# KAFKA
KAFKA_BOOTSTRAP_SERVERS_STAGE=staging-kafka:9092
KAFKA_TOPICS_STAGE=staging-events,staging-measurements
SCHEMA_REGISTRY_STAGE=http://staging-schema:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE=raw-measurements-staging
KAFKA_CLIENT_ID_STAGE=airqo-staging-client
KAFKA_CLIENT_GROUP_STAGE=airqo-staging-group

# SECURITY
STAGE_BYPASS_CAPTCHA=false
STAGE_BYPASS_RATE_LIMIT=false
SUPER_ADMIN_EMAIL_ALLOWLIST=admin@airqo.net
RATE_LIMIT_WHITELIST=10.0.0.0/8

# FIREBASE REDIRECT
FIREBASE_VERIFICATION_SUCCESS_REDIRECT=https://staging-analytics.airqo.net/verify-success
```

### Production Environment (Template)

```bash
# NODE & APP
NODE_ENV=production
PORT=3000

# JWT (USE STRONG SECRETS!)
JWT_SECRET=REPLACE-WITH-STRONG-PRODUCTION-SECRET-MIN-32-CHARS
JWT_EXPIRES_IN_SECONDS=86400
JWT_REFRESH_WINDOW_SECONDS=3600
JWT_GRACE_PERIOD_SECONDS=300

# DATABASE
MONGO_PROD=auth_prod
MONGO_PROD_URI=mongodb+srv://prod-cluster.mongodb.net/auth_prod
COMMAND_MONGO_PROD_URI=mongodb+srv://prod-cluster.mongodb.net/auth_prod
QUERY_MONGO_PROD_URI=mongodb+srv://prod-cluster.mongodb.net/auth_prod
DB_NAME_PROD=auth_prod

# URLS (MUST BE HTTPS)
PLATFORM_PRODUCTION_BASE_URL=https://platform.airqo.net
ANALYTICS_PRODUCTION_BASE_URL=https://analytics.airqo.net

# KAFKA
KAFKA_BOOTSTRAP_SERVERS_PROD=prod-kafka-1:9092,prod-kafka-2:9092,prod-kafka-3:9092
KAFKA_TOPICS_PROD=prod-events,prod-measurements,prod-alerts
SCHEMA_REGISTRY_PROD=https://schema-registry.airqo.net:8081
KAFKA_RAW_MEASUREMENTS_TOPICS_PROD=raw-measurements-prod
KAFKA_CLIENT_ID_PROD=airqo-prod-client
KAFKA_CLIENT_GROUP_PROD=airqo-prod-group

# SECURITY (STRICT)
PROD_BYPASS_CAPTCHA=false
PROD_BYPASS_RATE_LIMIT=false
SUPER_ADMIN_EMAIL_ALLOWLIST=admin@airqo.net,security@airqo.net
RATE_LIMIT_WHITELIST=52.45.23.1

# FIREBASE REDIRECT
FIREBASE_VERIFICATION_SUCCESS_REDIRECT=https://analytics.airqo.net/verify-success
```

---

## 🔒 Security Quick Tips

### Generate Strong Secrets

```bash
# For JWT_SECRET and SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or using OpenSSL
openssl rand -hex 32

# Or using Python
python -c "import secrets; print(secrets.token_hex(32))"
```

### ⚠️ NEVER COMMIT THESE FILES
Add to `.gitignore`:
```gitignore
.env
.env.local
.env.*.local
.env.development
.env.staging
.env.production
```

---

## ✅ Validation Tests

After configuration, run these checks:

### 1. Environment Variables Loaded
```bash
node -e "require('dotenv').config(); console.log('NODE_ENV:', process.env.NODE_ENV)"
# Should output your environment
```

### 2. MongoDB Connection
```bash
# Try connecting
mongosh $MONGO_DEV_URI  # or MONGO_STAGE_URI, MONGO_PROD_URI
```

### 3. Redis Connection
```bash
redis-cli -h $DEV_REDIS_HOST -p $DEV_REDIS_PORT ping
# Should return: PONG
```

### 4. Kafka Connection
```bash
kafka-topics --bootstrap-server $KAFKA_BOOTSTRAP_SERVERS_DEV --list
# Should list topics
```

### 5. JWT Configuration
```bash
node -e "
require('dotenv').config();
console.log('JWT Expiry:', process.env.JWT_EXPIRES_IN_SECONDS);
console.log('Refresh Window:', process.env.JWT_REFRESH_WINDOW_SECONDS);
console.log('Valid:', process.env.JWT_REFRESH_WINDOW_SECONDS < process.env.JWT_EXPIRES_IN_SECONDS);
"
```

---

## 🐛 Common Issues & Quick Fixes

### Issue: "Cannot find module 'dotenv'"
```bash
npm install dotenv
```

### Issue: MongoDB connection refused
```bash
# Check if MongoDB is running
systemctl status mongod  # Linux
brew services list       # macOS

# Start if not running
systemctl start mongod   # Linux
brew services start mongodb-community  # macOS
```

### Issue: Redis connection refused
```bash
# Check if Redis is running
redis-cli ping

# Start if not running
redis-server
```

### Issue: Environment variables not loading
```bash
# Make sure you're loading dotenv
# Add to top of your main file:
require('dotenv').config();
```

### Issue: JWT tokens not working
```bash
# Verify these are numbers, not strings
JWT_EXPIRES_IN_SECONDS=86400
# NOT: JWT_EXPIRES_IN_SECONDS="86400"
```

---

## 📚 Next Steps

1. **Review Full Documentation:**
   - `README_TEMPLATES.md` - Complete usage guide
   - `COMPARISON_CHART.md` - Detailed variable comparison
   - `SETUP_GUIDE.md` - In-depth setup instructions

2. **Configure Remaining Variables:**
   - Email settings (SMTP)
   - Firebase credentials
   - Google OAuth
   - Payment processing (Paddle)
   - Social media integrations

3. **Set Up CI/CD:**
   - Use secrets management (AWS Secrets Manager, etc.)
   - Never commit `.env` files
   - Use environment-specific deployments

4. **Monitor & Test:**
   - Set up application monitoring
   - Configure logging
   - Run integration tests
   - Performance testing

---

## 🆘 Need Help?

1. **Missing Variables:** Check `ANALYSIS_REPORT.md`
2. **Example Values:** See `SETUP_GUIDE.md`
3. **Code References:** Review `src/auth-service/config/environments/`
4. **Environment Comparison:** See `COMPARISON_CHART.md`

---

## ⚡ Pro Tips

1. **Use Environment-Specific Files:**
   ```bash
   .env.development.local  # Your local overrides (gitignored)
   .env.development        # Team development defaults
   ```

2. **Validate Before Deploy:**
   ```bash
   # Create a simple validation script
   node scripts/validate-env.js
   ```

3. **Document Your Setup:**
   Keep a `SETUP_NOTES.md` with your specific configuration choices

4. **Rotate Secrets Regularly:**
   Set reminders to rotate production secrets quarterly

5. **Monitor Configuration:**
   Set up alerts for missing or invalid environment variables

---

**Ready to Go?** 🎉

Your environment should now be configured and ready to use!

```bash
npm start  # or yarn start
```

Check the logs to ensure all services connect successfully.
