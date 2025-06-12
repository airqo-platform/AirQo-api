# Environment Check Script Documentation

## Overview

A diagnostic tool to troubleshoot environment detection issues, particularly for determining when Kafka should start in your Node.js application.

## Setup

1. **Create the script:**

   ```bash
   # Place the script in your config folder
   touch config/check-environment.js
   ```

2. **Add to package.json:**
   ```json
   {
     "scripts": {
       "env:check": "node config/check-environment.js",
       "env:debug": "DEBUG_ENV=true node config/check-environment.js"
     }
   }
   ```

## Usage

```bash
# Basic environment check
npm run env:check

# Detailed debug mode
npm run env:debug
```

## Output Sections

### 📊 Basic Environment Variables

- `NODE_ENV` value and type
- NPM lifecycle events
- Port configuration

### ⚙️ Constants Analysis

- How your constants file interprets the environment
- Character-by-character analysis for hidden characters
- Transformation results (lowercase, trimmed)

### 🧪 Environment Detection Tests

- Comparison results for different environment checks
- Boolean outcomes for various conditions

### 🚀 Kafka Decision Logic

- Shows whether Kafka will start with current logic
- Tests multiple detection methods
- Color-coded results (🟢 won't start, 🟡 will start)

### 💡 Recommended Conditions

- Ranked list of reliable environment detection methods
- Safety ratings for each approach

## Common Issues & Quick Fixes

| Issue                                   | Symptom                    | Fix                                              |
| --------------------------------------- | -------------------------- | ------------------------------------------------ |
| `NODE_ENV: undefined`                   | Kafka starts unexpectedly  | Use `npm run dev` instead of generic commands    |
| Constants show "PRODUCTION ENVIRONMENT" | Wrong environment detected | Set `NODE_ENV=development` in `.env` file        |
| Environment mismatch                    | Checks disagree            | Use direct `NODE_ENV` check instead of constants |

## Quick Commands

```bash
# Set development environment permanently
echo "NODE_ENV=development" >> .env

# Always use explicit dev scripts
npm run dev-mac    # or dev-pc, or dev

# Verify environment before starting
npm run env:check && npm run dev
```

## Interpreting Results

### ✅ Good State

- `NODE_ENV` is explicitly set
- All checks agree on environment
- Kafka decision matches expectation

### ⚠️ Warning State

- Environment checks disagree
- Using risky detection methods
- Missing environment variables

### ❌ Problem State

- `NODE_ENV: undefined`
- Unexpected Kafka startup behavior
- Constants file issues

## Best Practices

1. **Always set NODE_ENV explicitly** in your scripts
2. **Use direct `NODE_ENV` checks** instead of transformed constants
3. **Run `env:check` before debugging** environment issues
4. **Default to production** in constants for security (fail-safe)

## Example Output

```
🚀 KAFKA DECISION LOGIC:
constants.ENVIRONMENT !== "DEVELOPMENT ENVIRONMENT": true
✅ Kafka will START with current logic
```

This tells you exactly what will happen when your app starts.
