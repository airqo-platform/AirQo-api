# AirQo API: Device Status & Accuracy Tracking

## Executive Summary

### Common Issues & Solutions

#### Issue 1: Accuracy Dropping Below 95%

**Symptoms**:

```
Device: aq_device_042
Accuracy: 88%
Incorrect checks: 1,051 / 8,760 (12%)
```

**Possible Causes**:

1. **Network instability** - Devices going offline frequently
2. **Data processing delays** - Calibration taking >5 hours
3. **Threshold misconfiguration** - Wrong timeout values
4. **Clock skew** - Device time different from server time
5. **ThingSpeak API issues** - External service degradation

**Investigation Steps**:

```bash
# 1. Check recent accuracy stats
db.devices.find({
  "onlineStatusAccuracy.accuracyPercentage": { $lt: 95 }
}).project({
  name: 1,
  "onlineStatusAccuracy.accuracyPercentage": 1,
  "onlineStatusAccuracy.lastIncorrectReason": 1,
  "onlineStatusAccuracy.incorrectChecks": 1
})

# 2. Group by failure reason
db.devices.aggregate([
  { $match: { "onlineStatusAccuracy.accuracyPercentage": { $lt: 95 } } },
  { $group: {
      _id: "$onlineStatusAccuracy.lastIncorrectReason",
      count: { $sum: 1 },
      devices: { $push: "$name" }
  }},
  { $sort: { count: -1 } }
])

# 3. Check if specific to location
db.devices.aggregate([
  { $lookup: {
      from: "sites",
      localField: "site_id",
      foreignField: "_id",
      as: "site"
  }},
  { $match: { "onlineStatusAccuracy.accuracyPercentage": { $lt: 95 } } },
  { $group: {
      _id: "$site.name",
      avgAccuracy: { $avg: "$onlineStatusAccuracy.accuracyPercentage" },
      deviceCount: { $sum: 1 }
  }}
])

# 4. Review timestamp validation failures
db.devices.find({
  "onlineStatusAccuracy.lastIncorrectReason": "invalid_timestamp"
}).count()
```

**Solutions by Root Cause**:

| Root Cause                 | Solution                           | Timeline  |
| -------------------------- | ---------------------------------- | --------- |
| Network instability        | Check ISP, replace SIM card        | 1-2 days  |
| Processing delays          | Optimize calibration pipeline      | 1-2 weeks |
| Threshold misconfiguration | Adjust INACTIVE_THRESHOLD constant | Immediate |
| Clock skew                 | Enable NTP sync on devices         | 1-3 days  |
| API issues                 | Add retry logic, backup API        | 1 week    |

#### Issue 2: Devices Stuck in Wrong State

**Symptoms**:

```
Device: aq_device_042
isOnline: false
lastActive: 2024-11-16 08:00 (4 hours ago)
Recent events: 50 measurements in last hour
Expected: Should show as online
```

**Root Cause**: Stale entity (hasn't been checked recently)

**Why This Happens**:

- Device was offline for >10 hours (STALE_ENTITY_THRESHOLD)
- `lastCheck` timestamp exceeded threshold
- Device not processed by recent job runs
- Stuck in old state despite recent data

**Automatic Fix**: Stale entity processor runs every hour

**Manual Fix**:

```javascript
// Option 1: Force re-evaluation by clearing lastCheck
db.devices.updateOne(
  { name: "aq_device_042" },
  { $unset: { "onlineStatusAccuracy.lastCheck": "" } }
);
// Next job run will re-evaluate

// Option 2: Manually update status with accuracy tracking
const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
  isCurrentlyOnline: false,
  isNowOnline: true,
  currentStats: device.onlineStatusAccuracy,
  reason: "manual_correction",
});

db.devices.updateOne(
  { name: "aq_device_042" },
  {
    $set: { isOnline: true, ...setUpdate },
    $inc: incUpdate,
  }
);
```

**Prevention**:

```javascript
// Ensure stale entity processor runs
STALE_ENTITY_THRESHOLD = 2 × INACTIVE_THRESHOLD;  // 10 hours for deployed devices
STALE_BATCH_SIZE = 30;  // Process 30 stale entities per run
```

#### Issue 3: High ThingSpeak Error Rate

**Symptoms**:

```
📊 Raw Status Job Report
   Devices processed: 1,245
   Successful fetches: 1,058 (85%)
   Errors: 187 (15%) 🚨

   Error breakdown:
   ├─ Timeout: 95 (51%)
   ├─ Connection refused: 62 (33%)
   └─ Invalid response: 30 (16%)
```

**Possible Causes**:

1. **API rate limiting** - Too many concurrent requests
2. **Network congestion** - Peak usage times
3. **ThingSpeak service degradation** - External issue
4. **Invalid API keys** - Configuration problems

**Investigation**:

```bash
# Check error patterns by time
db.devices.aggregate([
  {
    $match: {
      "onlineStatusAccuracy.lastIncorrectReason": {
        $in: ["fetch_error", "timeout", "connection_refused"]
      }
    }
  },
  {
    $group: {
      _id: {
        hour: { $hour: "$onlineStatusAccuracy.lastIncorrectCheck" }
      },
      count: { $sum: 1 }
    }
  },
  { $sort: { "_id.hour": 1 } }
])

# Check if specific API keys are problematic
db.devices.find({
  "onlineStatusAccuracy.lastIncorrectReason": "fetch_error",
  readKey: { $exists: true }
}).count()
```

**Solutions**:

**Short-term**:

```javascript
// Reduce concurrency
CONCURRENCY_LIMIT = 3; // Down from 5

// Increase timeout
REQUEST_TIMEOUT = 45000; // Up from 30000

// Add delay between batches
REQUEST_DELAY = 200; // Up from 100
```

**Long-term**:

```javascript
// Implement exponential backoff
async function fetchWithRetry(channel, apiKey, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchThingspeakData(channel, apiKey);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(Math.pow(2, i) * 1000); // 1s, 2s, 4s
    }
  }
}

// Cache successful responses
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Use cache to reduce API calls
if (
  cache.has(cacheKey) &&
  cache.get(cacheKey).timestamp > Date.now() - CACHE_TTL
) {
  return cache.get(cacheKey).data;
}
```

#### Issue 4: PM2.5 Values Not Updating

**Symptoms**:

```
Device: aq_device_042
isOnline: true ✅
lastActive: 2024-11-16 12:45 ✅
latest_pm2_5.calibrated.value: 15.5
latest_pm2_5.calibrated.time: 2024-11-15 08:00 ❌ (28 hours old)
```

**Possible Causes**:

1. **Invalid PM2.5 values** - Sensor returning null or out-of-range
2. **Out-of-order events** - Old data arriving after new data
3. **Validation failures** - Values failing quality checks
4. **Calibration issues** - Cloud processing not producing PM2.5

**Investigation**:

```bash
# Check for validation failures
# Look at job logs for "skippedNullPm25" metric

# Check recent events for this device
db.events.find({
  device_id: ObjectId("..."),
  time: { $gte: ISODate("2024-11-15T08:00:00Z") }
}).sort({ time: -1 }).limit(10).project({
  time: 1,
  "pm2_5.value": 1
})

# Check if device is sending data
db.events.find({
  device_id: ObjectId("..."),
  time: { $gte: ISODate("2024-11-16T00:00:00Z") }
}).count()
```

**Solutions**:

If sensor returning invalid values:

```javascript
// Check sensor calibration
// Replace sensor if consistently invalid

// Temporary: Accept wider range
function isValidPM25(value) {
  return (
    value !== null &&
    value !== undefined &&
    !isNaN(value) &&
    value >= 0 &&
    value <= 2000
  ); // Increased from 1000
}
```

If out-of-order events:

```javascript
// This is expected behavior (working as designed)
// Old events won't overwrite newer PM2.5 values
// Only newer timestamps update latest_pm2_5
```

If calibration not producing PM2.5:

```javascript
// Check calibration pipeline logs
// Verify device has calibration model
// Use raw PM2.5 as fallback

if (!event.pm2_5.calibrated && event.pm2_5.raw) {
  device.latest_pm2_5.calibrated = {
    value: event.pm2_5.raw.value,
    time: event.time,
    note: "Using raw value (calibration unavailable)",
  };
}
```

#### Issue 5: Job Taking Too Long

**Symptoms**:

```
⚠️ Calibrated Status Job timeout after 15 minutes
   Processed: 800 / 1,245 devices
   Average time per device: 1.1s
   Expected: <0.5s per device
```

**Possible Causes**:

1. **Slow database queries** - Missing indexes
2. **Network latency** - Slow external API calls
3. **Large result sets** - Too many events fetched
4. **Inefficient processing** - Non-optimized code paths

**Investigation**:

```bash
# Check slow queries
db.setProfilingLevel(2); // Profile all queries
db.system.profile.find({ millis: { $gt: 1000 } }).sort({ millis: -1 });

# Check index usage
db.devices.find({
  lastActive: { $lt: new Date(Date.now() - 5*60*60*1000) },
  isOnline: true
}).explain("executionStats");

# Check event fetch performance
db.events.find({
  recent: "yes",
  active: "yes"
}).explain("executionStats");
```

**Solutions**:

**Database optimization**:

```javascript
// Add missing indexes
db.devices.createIndex({
  lastActive: 1,
  createdAt: 1,
  isOnline: 1,
});

db.events.createIndex({
  time: -1,
  device_id: 1,
});

// Use projection to reduce data transfer
const devices = await Device.find(filter)
  .select("_id name isOnline lastActive onlineStatusAccuracy")
  .lean();
```

**Batch size tuning**:

```javascript
// Reduce batch sizes if processing is slow
FETCH_BATCH_SIZE = 100; // Down from 200
STATUS_UPDATE_BATCH_SIZE = 250; // Down from 500

// Or increase if database is fast but network is slow
FETCH_BATCH_SIZE = 500; // Up from 200
```

**Parallel processing**:

```javascript
// Process multiple batches concurrently (with caution)
const batches = chunk(devices, BATCH_SIZE);
await Promise.all(batches.slice(0, 3).map((batch) => processBatch(batch)));
// Process first 3 batches in parallel, then next 3, etc.
```

**Query optimization**:

```javascript
// Instead of fetching all events then filtering
const allEvents = await fetchAllRecentEvents();
const relevantEvents = allEvents.filter((e) => e.device_id);

// Fetch only what's needed with better query
const relevantEvents = await Event.find({
  time: { $gte: new Date(Date.now() - 5 * 60 * 60 * 1000) },
  device_id: { $exists: true },
  "pm2_5.value": { $ne: null },
}).lean();
```

---

## Questions & Definitions

### Q: What's the difference between "connected" and "active"?

**Connected (Online Status)**:

- **Definition**: Device transmitting data right now
- **Field**: `isOnline` or `rawOnlineStatus`
- **Timeframe**: Current moment
- **Determination**: Based on recent data (1-5 hours)
- **Example**: `isOnline: true` means device sent data recently

**Active (Business Status)**:

- **Definition**: Device is deployed at a location
- **Field**: `status` (e.g., "deployed", "not deployed", "testing")
- **Timeframe**: Deployment lifecycle
- **Determination**: Manual assignment/business process
- **Example**: `status: "deployed"` means device is in the field

**Important**: A device can be deployed (active) but not transmitting (not connected)

| Scenario                   | Status (Active) | isOnline (Connected) | Interpretation                  |
| -------------------------- | --------------- | -------------------- | ------------------------------- |
| Newly deployed, working    | "deployed"      | true                 | ✅ Normal operation             |
| Deployed, hardware failure | "deployed"      | false                | 🚨 Needs attention              |
| In warehouse, powered on   | "not deployed"  | true                 | ⚠️ Testing/QA                   |
| In warehouse, powered off  | "not deployed"  | false                | ✅ Normal (not yet deployed)    |
| Being repaired             | "recalled"      | false                | ✅ Expected (under maintenance) |

### Q: Why two different thresholds (1 hour vs 5 hours)?

**1 Hour Threshold (Raw Data)**:

- **Used for**: Mobile devices, non-deployed devices
- **Data source**: ThingSpeak raw data feed
- **Latency**: Minimal (device → ThingSpeak: seconds)
- **Purpose**: Faster detection of connectivity issues
- **Trade-off**: May show false negatives during brief network outages

**5 Hour Threshold (Calibrated Data)**:

- **Used for**: Deployed static devices
- **Data source**: Cloud-processed, calibrated measurements
- **Latency**: Variable (includes calibration processing time)
- **Purpose**: More stable status, accounts for processing delays
- **Trade-off**: Slower detection of issues, but higher data quality

**Why Different Latencies?**

```
Raw Data Path:
Device → ThingSpeak → Status Check
         (5 seconds)    (:35 each hour)
Total latency: < 1 minute

Calibrated Data Path:
Device → Cloud → Calibration → Quality Check → Database → Status Check
         (varies)  (1-3 hours)   (30 mins)     (minutes)    (:45 each hour)
Total latency: 1-4 hours
```

**Example Scenario**:

```
10:00 AM - Device sends measurement
           └─ Arrives at ThingSpeak: 10:00:05

10:35 AM - Raw status job checks ThingSpeak
           └─ Finds data from 10:00 (35 minutes old)
           └─ Updates: rawOnlineStatus = true ✅

10:00 AM - Device sends measurement
           └─ Cloud processes data: 10:00 - 12:00

12:45 PM - Calibrated status job checks database
           └─ Finds calibrated data from 10:00 (2h 45m old)
           └─ Updates: isOnline = true ✅
           └─ Still within 5-hour threshold
```

### Q: How often is accuracy calculated?

**Every Status Update (Hourly)**:

- Calibrated job: Every hour at :45
- Raw status job: Every hour at :35
- Each device checked once per job
- **Total checks per device per day**: 48 (24 × 2 jobs)

**Cumulative Over Device Lifetime**:

- Counter never resets
- `totalChecks` increments with each check
- `accuracyPercentage` computed from all historical checks
- Example: Device active 1 year = 17,520 checks (48 × 365)

**Historical Trends Available**:

- Daily accuracy: Rolling 24-hour window
- Weekly accuracy: Rolling 7-day window
- Monthly accuracy: Rolling 30-day window
- All-time accuracy: Since device creation

**Query Examples**:

```javascript
// Current accuracy
db.devices.findOne(
  { name: "aq_001" },
  { "onlineStatusAccuracy.accuracyPercentage": 1 }
);

// Accuracy trend (requires time-series data)
// Note: Current implementation doesn't store historical snapshots
// For trends, would need to log accuracy at intervals

// All devices with low accuracy
db.devices
  .find({
    "onlineStatusAccuracy.accuracyPercentage": { $lt: 95 },
  })
  .count();
```

### Q: What causes accuracy to drop?

#### 1. Network Instability

**Symptom**: Devices alternating online/offline frequently

**Root Cause**:

- Weak cellular signal
- ISP network issues
- Data plan exhaustion
- SIM card problems

**Impact on Accuracy**:

- System shows "online" but device drops offline before check completes
- Or vice versa: Shows "offline" but device reconnects immediately

**Solution**:

- Upgrade to better ISP/data plan
- Relocate device for better signal
- Add cellular signal booster

#### 2. Data Processing Delays

**Symptom**: Calibration taking longer than 5-hour threshold

**Root Cause**:

- High cloud processing load
- Calibration model complexity
- Database performance issues
- Queue backlog

**Impact on Accuracy**:

- Device marked offline during calibration lag
- Calibrated data arrives after threshold expires

**Solution**:

- Optimize calibration pipeline
- Increase processing capacity
- Adjust threshold if consistently delayed

#### 3. Threshold Configuration Problems

**Symptom**: Threshold too short/long for actual latencies

**Root Cause**:

- Threshold doesn't match real-world data latency
- Different device types need different thresholds
- Network characteristics changed

**Impact on Accuracy**:

- Too short: False negatives (shows offline when online)
- Too long: False positives (shows online when offline)

**Solution**:

- Analyze actual latency distribution
- Adjust thresholds based on P95/P99 latency
- Use different thresholds per device category

#### 4. Device Hardware Issues

**Symptom**: Intermittent sensor/modem failures

**Root Cause**:

- Degrading hardware components
- Power supply fluctuations
- Environmental damage (water, heat)
- Firmware bugs

**Impact on Accuracy**:

- Unpredictable transmission patterns
- System can't reliably predict device state

**Solution**:

- Replace faulty hardware
- Update firmware
- Improve weatherproofing
- Schedule regular maintenance

---

## Summary

### System Overview

✅ **Two-tier status tracking** ensures comprehensive monitoring:

- Raw status: Fast detection via ThingSpeak (1-hour threshold)
- Calibrated status: High-quality data via cloud processing (5-hour threshold)

✅ **Accuracy metrics** provide confidence in monitoring reliability:

- Track correct vs incorrect status determinations
- Identify patterns in failures
- Enable continuous improvement

✅ **Automated hourly updates** keep status current:

- Jobs run at :35 (raw) and :45 (calibrated) each hour
- Process thousands of devices in minutes
- Graceful handling of timeouts and errors

✅ **Multi-level aggregation** supports various analysis needs:

- Device level: Individual diagnostics
- Site level: Location performance
- Network level: Regional health dashboards

✅ **Built-in safeguards** ensure system reliability:

- Timestamp validation prevents data corruption
- Out-of-order handling maintains data integrity
- Graceful degradation allows partial success
- Race condition prevention ensures consistency

### Key Takeaways for Operators

**Daily Operations**:

1. Monitor accuracy dashboard for devices <95%
2. Review daily summary report at 12 PM EAT
3. Respond to critical alerts within 4 hours
4. Schedule maintenance for declining accuracy

**Troubleshooting**:

1. Check accuracy reasons first: `lastIncorrectReason`
2. Use query examples to investigate patterns
3. Compare raw vs calibrated status for diagnosis
4. Review job logs for batch statistics

**Best Practices**:

1. Target ≥98% accuracy for all devices
2. Investigate any device with <95% accuracy
3. Track accuracy trends over time
4. Document and share failure patterns

### Key Takeaways for Developers

**System Design**:

1. Status determination is threshold-based (1h or 5h)
2. Accuracy tracks correctness of status determinations
3. Two jobs cooperate: raw (fast) and calibrated (quality)
4. All operations are atomic and idempotent

**Performance**:

1. Use indexes for all time-based queries
2. Batch updates in groups of 500 for optimal throughput
3. Stream large result sets with cursors
4. Yield control every 10 operations

**Reliability**:

1. Always validate timestamps before using
2. Use filter queries to prevent out-of-order updates
3. Implement timeout protection (10-15 minutes)
4. Use `ordered: false` for bulk writes

**Monitoring**:

1. Log all accuracy updates with reasons
2. Track batch statistics (new data vs re-evaluations)
3. Report job duration and throughput
4. Alert on accuracy <95% or job timeout

---

## Bottom Line

Our system provides **accurate, real-time device connectivity status** with **measurable reliability metrics**, enabling **data-driven operational decisions**.

**Core Capabilities**:

- ✅ Real-time status tracking (updated hourly)
- ✅ 97-99% accuracy in status determination
- ✅ Automatic error detection and recovery
- ✅ Comprehensive monitoring and alerting
- ✅ Scalable to thousands of devices

**Business Value**:

- 🎯 Reduced false alarms (saves ~\$30K/year)
- 🎯 Faster issue detection (<1 hour vs 2-7 days)
- 🎯 Higher data quality (98% vs 85% industry average)
- 🎯 Lower operational costs (proactive vs reactive maintenance)
- 🎯 Better stakeholder confidence (transparent, measurable reliability) Overview

Our system tracks device connectivity status in real-time and measures the accuracy of these status determinations. This document explains how we determine if devices are "connected" and how we measure the reliability of our tracking system.

---

## How Device Status is Determined

### Two Types of Status Tracking

| Status Type                      | What It Tracks                                  | Update Frequency    | Data Source                  |
| -------------------------------- | ----------------------------------------------- | ------------------- | ---------------------------- |
| **Calibrated Status (isOnline)** | Processed, quality-controlled data availability | Every hour (at :45) | Cloud-processed measurements |
| **Raw Status (rawOnlineStatus)** | Direct device transmission                      | Every hour (at :35) | ThingSpeak raw data feed     |

### Understanding the Three Status Fields

Our system maintains three related but distinct status fields:

| Field             | Scope          | Updated By                    | Use Case                              |
| ----------------- | -------------- | ----------------------------- | ------------------------------------- |
| `isOnline`        | Primary status | Both jobs (context-dependent) | Main status shown in dashboards       |
| `rawOnlineStatus` | Raw data feed  | Raw status job (:35)          | All devices, regardless of deployment |
| `statusUpdatedAt` | Metadata       | Both jobs                     | Last time status was checked          |

### Status Update Rules by Device Type

#### For Deployed Devices (status = "deployed")

- **rawOnlineStatus**: Always updated by raw status job
- **isOnline**: Updated by calibrated job only (using 5-hour threshold)
- **Rationale**: Deployed devices use calibrated data for higher quality readings

#### For Non-Deployed/Mobile Devices

Devices with status in: `["not deployed", "ready", "testing", "recalled", etc.]`

- **rawOnlineStatus**: Updated by raw status job
- **isOnline**: ALSO updated by raw status job (using 1-hour threshold)
- **Rationale**: Mobile/testing devices use raw data for faster issue detection

### Status Determination Logic

#### For Deployed Devices

- **Connected** = Device has sent calibrated data within last 5 hours
- **Not Connected** = No calibrated data for more than 5 hours
- Uses processed data that has undergone quality checks

#### For Non-Deployed/Mobile Devices

- **Connected** = Device has sent raw data within last 1 hour
- **Not Connected** = No raw data for more than 1 hour
- Uses direct transmission data from device hardware

---

## Job Scheduling Strategy

### Why Two Different Times?

#### Raw Status Job (:35 past each hour)

- **Timing**: Runs at 35 minutes past each hour
- **Data Source**: ThingSpeak raw data feed
- **Processing**: Minimal latency from device to ThingSpeak
- **Updates**: `rawOnlineStatus` for ALL devices
- **Execution Time**: ~10 minutes typical
- **Threshold**: 1 hour for mobile/non-deployed, 5 hours for deployed

#### Calibrated Status Job (:45 past each hour)

- **Timing**: Runs at 45 minutes past each hour
- **Data Source**: Cloud-processed, calibrated measurements
- **Processing**: Requires time for quality checks and calibration
- **Updates**: `isOnline` for deployed devices only
- **Execution Time**: ~10-15 minutes typical
- **Threshold**: 5 hours (allows time for data processing)

### Why the 10-Minute Offset?

**Key Benefits**:

1. **Prevents Resource Contention**: Jobs don't compete for database/API resources
2. **Data Availability**: Raw data is available before calibrated processing begins
3. **Cascading Updates**: Raw status can inform calibrated status decisions
4. **Error Recovery**: If raw job runs long, calibrated job still has buffer time

### Job Execution Timeline Example

```
12:35 - Raw Status Job starts
  ├─ Fetch ThingSpeak data for all devices
  ├─ Update rawOnlineStatus (all devices)
  └─ Update isOnline (mobile/non-deployed only)
12:42 - Raw Status Job completes (7 minutes)

12:45 - Calibrated Status Job starts
  ├─ Fetch calibrated events (deployed devices only)
  ├─ Update isOnline (deployed devices)
  └─ Update site status (aggregated)
12:52 - Calibrated Status Job completes (7 minutes)
```

---

## Accuracy Tracking System

### What We Measure

We track how accurately our system identifies device connectivity status by comparing:

- **Current Status** - What our system currently shows
- **New Status** - What incoming data tells us the status should be
- **Match/Mismatch** - Whether our current status was correct

### Accuracy Metrics

```
Accuracy Rate = (Correct Checks / Total Checks) × 100%
```

**Example:**

- Total Checks: 1,000
- Correct Checks: 950
- Incorrect Checks: 50
- **Accuracy Rate: 95%**

### How Accuracy is Calculated (Step-by-Step)

Each job execution performs these steps for each device/site:

#### Step 1: Fetch Current State

```javascript
{
  _id: "device_001",
  isOnline: true,  // What system currently shows
  lastActive: "2024-11-16T10:00:00Z",
  onlineStatusAccuracy: {
    totalChecks: 100,
    correctChecks: 95,
    incorrectChecks: 5,
    accuracyPercentage: 95.0
  }
}
```

#### Step 2: Determine New State from Recent Data

```javascript
// Check if device sent data within threshold window
const timeSinceLastData = now - lastEventTime;
const isNowOnline = timeSinceLastData < THRESHOLD;

// For deployed devices: THRESHOLD = 5 hours
// For mobile devices: THRESHOLD = 1 hour
```

#### Step 3: Compare & Update

```javascript
const isTruthful = (currentState.isOnline === isNowOnline);

if (isTruthful) {
  correctChecks++;
  reason = "status_confirmed";
} else {
  incorrectChecks++;
  reason = "status_corrected";
}

totalChecks++;
accuracyPercentage = (correctChecks / totalChecks) × 100;
```

#### Step 4: Update Database

```javascript
// Increment counters
$inc: {
  "onlineStatusAccuracy.totalChecks": 1,
  "onlineStatusAccuracy.correctChecks": isTruthful ? 1 : 0,
  "onlineStatusAccuracy.incorrectChecks": isTruthful ? 0 : 1
}

// Update timestamps and percentages
$set: {
  "onlineStatusAccuracy.lastCheck": new Date(),
  "onlineStatusAccuracy.accuracyPercentage": accuracyPercentage,
  "onlineStatusAccuracy.lastCorrectCheck": isTruthful ? new Date() : undefined,
  "onlineStatusAccuracy.lastIncorrectCheck": !isTruthful ? new Date() : undefined,
  "onlineStatusAccuracy.lastIncorrectReason": !isTruthful ? reason : undefined
}
```

### Accuracy Reasons (Status Source Field)

| Reason                          | Meaning                                       | Impact on Accuracy                 |
| ------------------------------- | --------------------------------------------- | ---------------------------------- |
| `status_confirmed`              | System was correct, status unchanged          | ✅ Correct check                   |
| `status_corrected`              | System was wrong, now fixed                   | ❌ Incorrect check                 |
| `status_confirmed_reevaluation` | Out-of-order event, status still correct      | ✅ Correct check                   |
| `status_corrected_reevaluation` | Out-of-order event, status was wrong          | ❌ Incorrect check                 |
| `cron_offline_detection`        | Job marked device offline (was online before) | Varies by previous state           |
| `status_confirmed_offline`      | Device was already offline, still offline     | ✅ Correct check                   |
| `device_offline_by_job`         | Device newly marked offline                   | Depends on previous state          |
| `online_raw`                    | Device online via raw data                    | ✅ Correct if was already online   |
| `offline_raw`                   | Device offline via raw data                   | ✅ Correct if was already offline  |
| `no_device_number`              | Device has no ThingSpeak channel              | ❌ Incorrect (technical issue)     |
| `no_readkey`                    | Missing API credentials                       | ❌ Incorrect (configuration issue) |
| `decryption_failed`             | Cannot decrypt API key                        | ❌ Incorrect (security issue)      |
| `fetch_error`                   | Error fetching from ThingSpeak                | ❌ Incorrect (external API issue)  |
| `invalid_timestamp`             | Data timestamp validation failed              | ❌ Incorrect (data quality issue)  |

### What Gets Tracked

For each device, we maintain:

#### Core Accuracy Fields

| Field                 | Description                           | Example Value    |
| --------------------- | ------------------------------------- | ---------------- |
| `totalChecks`         | Total number of status checks         | 10,000           |
| `correctChecks`       | Times status was correctly identified | 9,500            |
| `incorrectChecks`     | Times status was wrong                | 500              |
| `accuracyPercentage`  | Overall accuracy rate                 | 95%              |
| `lastCheck`           | Most recent status verification       | 2024-11-14 10:45 |
| `lastCorrectCheck`    | Last time status was correct          | 2024-11-14 10:45 |
| `lastIncorrectCheck`  | Last time status was incorrect        | 2024-11-10 08:30 |
| `lastIncorrectReason` | Reason for last incorrect check       | "fetch_error"    |

#### Legacy Fields (Backward Compatibility)

| Field                  | Description                       | Equivalent New Field       |
| ---------------------- | --------------------------------- | -------------------------- |
| `totalAttempts`        | Total status update attempts      | `totalChecks`              |
| `successfulUpdates`    | Successful status identifications | `correctChecks`            |
| `failedUpdates`        | Failed status identifications     | `incorrectChecks`          |
| `successPercentage`    | Success rate                      | `accuracyPercentage`       |
| `failurePercentage`    | Failure rate                      | 100 - `accuracyPercentage` |
| `lastUpdate`           | Last update time                  | `lastCheck`                |
| `lastSuccessfulUpdate` | Last successful update            | `lastCorrectCheck`         |
| `lastFailureReason`    | Last failure reason               | `lastIncorrectReason`      |

### Why Status Checks Might Be "Incorrect"

- **Data Processing Delays** - Device transmits but cloud processing not complete
- **Network Latency** - Data in transit during status check
- **Clock Skew** - Minor time differences between device and server
- **Threshold Edge Cases** - Data arrives just before/after threshold window
- **Out-of-Order Data** - Older data arrives after newer data already processed
- **API Failures** - ThingSpeak or other external APIs temporarily unavailable
- **Configuration Issues** - Missing or invalid device credentials
- **Validation Failures** - Data fails quality checks (invalid timestamps, PM2.5 values)

---

## Out-of-Order Event Handling

### The Problem

Events may arrive out of chronological order due to:

- **Network retries** - Failed transmissions retried later
- **Data processing delays** - Batch processing timing variations
- **Clock skew** - Time differences between device and server clocks
- **Queue processing** - Messages processed in different order than sent
- **Duplicate events** - Same data arrives multiple times via different paths

### The Solution: Race Condition Prevention

#### Update Only When Newer

```javascript
// Update ONLY if new data is actually newer than existing
db.devices.updateOne(
  {
    _id: deviceId,
    $or: [
      { lastActive: { $lt: newTimestamp } }, // New data is newer
      { lastActive: { $exists: false } }, // No existing data
    ],
  },
  {
    $set: {
      lastActive: newTimestamp,
      isOnline: newStatus,
      "latest_pm2_5.calibrated": pm25Data,
    },
  }
);
```

**Key Points**:

- Filter ensures we only update if `newTimestamp > lastActive`
- If filter doesn't match, update is skipped (no data regression)
- Atomic operation prevents race conditions between concurrent updates

#### What Happens to Stale Events?

When an out-of-order event arrives:

1. ❌ **Not Applied** to `lastActive` (prevents time regression)
2. ❌ **Not Applied** to `latest_pm2_5` (prevents data regression)
3. ✅ **Still Counted** for accuracy tracking (re-evaluation)
4. ✅ **Status Re-evaluated** based on current time, not event time

### Example Timeline

```
Time →

12:00 PM - Device sends Event A (PM2.5: 15.5)
12:05 PM - Event A arrives & processed
           ✅ lastActive = 12:00 PM
           ✅ latest_pm2_5 = 15.5
           ✅ isOnline = true

12:10 PM - Device sends Event B (PM2.5: 20.3)
12:12 PM - Event B arrives & processed
           ✅ lastActive = 12:10 PM (12:10 > 12:00)
           ✅ latest_pm2_5 = 20.3
           ✅ isOnline = true
           ✅ Accuracy: status_confirmed

12:15 PM - Event A arrives AGAIN (duplicate/retry)
           ❌ lastActive NOT updated (12:00 < 12:10)
           ❌ latest_pm2_5 NOT updated (stale)
           ✅ Status re-evaluated: still online (current time check)
           ✅ Accuracy: status_confirmed_reevaluation
           📊 Logged: skippedStaleEvents++
```

### Re-evaluation vs New Data

| Scenario                          | lastActive Updated? | PM2.5 Updated? | Accuracy Tracked? | Reason                                                             |
| --------------------------------- | ------------------- | -------------- | ----------------- | ------------------------------------------------------------------ |
| New data (timestamp > existing)   | ✅ Yes              | ✅ Yes         | ✅ Yes            | `status_confirmed` or `status_corrected`                           |
| Stale data (timestamp ≤ existing) | ❌ No               | ❌ No          | ✅ Yes            | `status_confirmed_reevaluation` or `status_corrected_reevaluation` |
| Invalid timestamp                 | ❌ No               | ❌ No          | ✅ Yes            | `invalid_timestamp`                                                |
| Null PM2.5 value                  | ✅ Yes              | ❌ No          | ✅ Yes            | `status_confirmed` (connectivity tracked separately)               |

### Metrics Logged

Each batch reports:

```
Device batch stats: 450 new data, 23 re-evaluations,
                    17 out-of-order, 5 invalid PM2.5
```

**Interpretation**:

- **450 new data**: Events with timestamps newer than existing
- **23 re-evaluations**: Status checked but data not updated
- **17 out-of-order**: Events older than current `lastActive`
- **5 invalid PM2.5**: Connectivity OK but sensor values rejected

---

## PM2.5 Data Validation

### Validation Rules

Before storing PM2.5 values, the system validates:

```javascript
function isValidPM25(value) {
  return (
    value !== null &&
    value !== undefined &&
    !isNaN(value) &&
    value >= 0 &&
    value <= 1000
  ); // Practical upper limit
}
```

### Validation Criteria

| Criterion          | Valid Range     | Invalid Examples    | Why Invalid               |
| ------------------ | --------------- | ------------------- | ------------------------- |
| Not null/undefined | Must have value | `null`, `undefined` | No measurement            |
| Is a number        | Numeric type    | `"15.5"`, `"N/A"`   | Wrong data type           |
| Non-negative       | ≥ 0             | `-5`, `-0.5`        | Physically impossible     |
| Below threshold    | ≤ 1000          | `1500`, `9999`      | Likely sensor malfunction |

**Why 1000 μg/m³?**

- Values above 1000 μg/m³ are extremely rare (beyond "hazardous" AQI levels)
- Often indicate sensor malfunction, power issues, or data corruption
- Highest recorded outdoor PM2.5: ~999 μg/m³ (Delhi, 2016)

### What Happens to Invalid Values

| Action                  | Applied? | Example                                               |
| ----------------------- | -------- | ----------------------------------------------------- |
| Store in `latest_pm2_5` | ❌ No    | Value rejected, field not updated                     |
| Update `lastActive`     | ✅ Yes   | Device is transmitting (connectivity OK)              |
| Update `isOnline`       | ✅ Yes   | Device status based on transmission, not data quality |
| Count in accuracy       | ✅ Yes   | Accuracy tracks connectivity, not data validity       |
| Log for debugging       | ✅ Yes   | `skippedNullPm25` metric incremented                  |

### Example Scenarios

#### Scenario 1: Null PM2.5 Value

```javascript
Device sends: {
  device_id: "aq_001",
  pm2_5: null,
  time: "2024-11-16T10:00:00Z"
}

Result:
✅ isOnline = true (device is transmitting)
✅ rawOnlineStatus = true
✅ lastActive = 2024-11-16T10:00:00Z
❌ latest_pm2_5.calibrated NOT updated (invalid value)
📊 skippedNullPm25++
```

#### Scenario 2: Out-of-Range Value

```javascript
Device sends: {
  device_id: "aq_001",
  pm2_5: { value: 5000 },  // Impossibly high
  time: "2024-11-16T10:05:00Z"
}

Result:
✅ isOnline = true
✅ lastActive = 2024-11-16T10:05:00Z
❌ latest_pm2_5.calibrated NOT updated (value > 1000)
📊 skippedNullPm25++
🔔 Alert: "Device aq_001 reporting suspicious PM2.5 value: 5000"
```

#### Scenario 3: Valid Value After Invalid

```javascript
10:00 - Device sends: { pm2_5: null }
        ✅ Online status updated
        ❌ PM2.5 not stored

10:05 - Device sends: { pm2_5: { value: 25.5 } }
        ✅ Online status updated
        ✅ PM2.5 stored: 25.5

Current state:
  lastActive: 10:05
  latest_pm2_5.calibrated.value: 25.5
  latest_pm2_5.calibrated.time: 10:05
```

### PM2.5 Data Structure

#### Raw PM2.5 (from ThingSpeak)

```javascript
latest_pm2_5.raw: {
  value: 15.5,        // Raw sensor reading
  time: Date          // When measurement was taken
}
```

#### Calibrated PM2.5 (from cloud processing)

```javascript
latest_pm2_5.calibrated: {
  value: 14.8,                    // Calibrated reading
  time: Date,                     // When measurement was taken
  uncertainty: 2.1,               // Measurement uncertainty (optional)
  standardDeviation: 1.5          // Standard deviation (optional)
}
```

### Quality Metrics

Track PM2.5 validation results:

```
📊 PM2.5 Validation Report:
   Total events: 1000
   Valid PM2.5: 950 (95%)
   Invalid PM2.5: 50 (5%)
     ├─ Null values: 30
     ├─ Out of range: 15
     └─ Non-numeric: 5
```

---

## Automated Status Updates

### Two Jobs Run Every Hour

#### Job 1: Calibrated Data Status (:45 each hour)

- **Purpose:** Update status for deployed devices
- **Checks:** Devices with site assignments
- **Threshold:** 5-hour window
- **Updates:** ~45 minutes past each hour
- **Max Execution Time:** 15 minutes
- **Batch Size:** 200 events per fetch, 500 updates per batch

#### Job 2: Raw Data Status (:35 each hour)

- **Purpose:** Update status for all devices (including mobile)
- **Checks:** All devices with ThingSpeak channels
- **Threshold:** 1-hour window (mobile), 5-hour window (deployed)
- **Updates:** ~35 minutes past each hour
- **Max Execution Time:** 10 minutes
- **Batch Size:** 50 devices per batch

### What Happens During Each Update

#### Calibrated Status Job (Deployed Devices)

1. **Fetch Recent Events**

   - Query: Recent calibrated measurements from cloud
   - Filter: `active=yes`, `metadata=site_id`, `recent=yes`
   - Batch size: 200 events
   - Max iterations: 10 batches
   - Deduplication: By device_id + timestamp

2. **Validate Timestamps**

   - Reject future timestamps (>5 minutes ahead)
   - Reject very old timestamps (>10 hours)
   - Handle clock skew gracefully

3. **Validate PM2.5 Values**

   - Check: 0 ≤ value ≤ 1000
   - Skip invalid values
   - Log validation failures

4. **Calculate Status**

   - For deployed devices: `lastActive < 5 hours ago` → online
   - Compare with current `isOnline` state

5. **Update Database (Batch)**

   - Status updates: 500 devices per batch
   - Accuracy updates: Separate batch operation
   - Use bulkWrite with `ordered: false`

6. **Update Site Status**

   - Aggregate device statuses per site
   - Update `site.isOnline` based on primary device
   - Update `site.latest_pm2_5.calibrated`

7. **Mark Offline Devices**

   - Find devices not in active list
   - Check `lastActive < 5 hours ago`
   - Batch update to `isOnline: false`

8. **Process Stale Entities**
   - Find devices with `lastCheck > 10 hours ago`
   - Force re-evaluation
   - Batch size: 30 entities

#### Raw Status Job (All Devices)

1. **Fetch All Devices**

   - Query: All devices with `device_number` (ThingSpeak channel)
   - Stream using cursor (memory efficient)
   - Batch size: 50 devices

2. **Fetch ThingSpeak Data**

   - Concurrent requests: 5 at a time
   - Timeout per request: 30 seconds
   - Decrypt API keys (readKey)

3. **Calculate Raw Status**

   - Parse latest feed from ThingSpeak
   - Check: `lastFeed < 1 hour ago` → online
   - Validate PM2.5 from raw feed

4. **Update Status Fields**

   - Always update: `rawOnlineStatus`
   - For mobile/non-deployed: Also update `isOnline`
   - Update `lastRawData` timestamp

5. **Update Accuracy**

   - Track: `rawOnlineStatus` changes
   - Increment counters
   - Calculate accuracy percentage

6. **Update Site (Primary Devices)**
   - If device is `isPrimaryInLocation`
   - Update site's `rawOnlineStatus`
   - Update site's `latest_pm2_5.raw`

---

## Performance Optimizations

### Non-Blocking Job Processing

Both jobs use **cooperative multitasking** to prevent blocking the Node.js event loop:

```javascript
// Configuration
YIELD_INTERVAL = 10              // Yield every 10 operations
MAX_EXECUTION_TIME = 15 minutes  // Calibrated job
MAX_EXECUTION_TIME = 10 minutes  // Raw status job
```

#### How Yielding Works

```javascript
class NonBlockingJobProcessor {
  async processWithYielding(operation) {
    this.operationCount++;

    // Periodically yield control back to event loop
    if (this.operationCount % YIELD_INTERVAL === 0) {
      await new Promise((resolve) => setImmediate(resolve));

      // Check if we should stop (timeout or shutdown)
      if (this.shouldStopExecution()) {
        throw new Error("Job stopped execution");
      }
    }

    return await operation();
  }
}
```

**Benefits**:

- ✅ Prevents blocking other API requests
- ✅ Allows graceful shutdown
- ✅ Prevents memory buildup
- ✅ Enables timeout handling

### Batch Processing Strategies

| Operation                   | Batch Size   | Reason                               | Configuration              |
| --------------------------- | ------------ | ------------------------------------ | -------------------------- |
| **Event Fetching**          | 200          | Balance query speed and memory usage | `FETCH_BATCH_SIZE`         |
| **Status Updates**          | 500          | MongoDB bulkWrite optimization       | `STATUS_UPDATE_BATCH_SIZE` |
| **Stale Entity Processing** | 30           | Smaller batches for edge cases       | `STALE_BATCH_SIZE`         |
| **ThingSpeak Fetching**     | 5 concurrent | Respect API rate limits              | `CONCURRENCY_LIMIT`        |
| **Device Streaming**        | 50           | Memory-efficient cursor processing   | `BATCH_SIZE`               |

#### Example: Batch Processing Flow

```javascript
// Process 1000 devices in batches of 50
const cursor = Device.find({}).lean().batchSize(50).cursor();
let batch = [];

for await (const device of cursor) {
  batch.push(device);

  if (batch.length >= 50) {
    // Process batch
    await processBatch(batch);

    // Yield control
    await processor.yieldControl();

    // Clear batch
    batch = [];

    // Small delay to prevent overwhelming external APIs
    await sleep(100);
  }
}

// Process remaining devices
if (batch.length > 0) {
  await processBatch(batch);
}
```

### Database Query Optimization

#### Critical Indexes

```javascript
// Device Model Indexes
deviceSchema.index({ site_id: 1 }); // Fast site lookups
deviceSchema.index({ mobility: 1 }); // Filter mobile devices
deviceSchema.index({ mobility: 1, cohorts: 1 }); // Mobile cohort queries
deviceSchema.index({ "onlineStatusAccuracy.lastCheck": 1 }); // Stale entity detection
deviceSchema.index({ lastActive: 1, createdAt: 1, isOnline: 1 }); // Offline detection

// Site Model Indexes
siteSchema.index({ lat_long: 1 }, { unique: true }); // Duplicate prevention
siteSchema.index({ generated_name: 1 }, { unique: true }); // Unique site names
siteSchema.index({ createdAt: -1 }); // Recent sites first
siteSchema.index({ "onlineStatusAccuracy.lastCheck": 1 }); // Stale entity detection
siteSchema.index({ lastActive: 1, createdAt: 1, isOnline: 1 }); // Offline detection
```

#### Query Optimization Techniques

**1. Projection (Select Only Needed Fields)**

```javascript
// Before: Fetch entire document (slow, memory-intensive)
const devices = await Device.find({});

// After: Fetch only needed fields (fast, memory-efficient)
const devices = await Device.find({})
  .select("_id name device_number readKey isOnline rawOnlineStatus")
  .lean(); // Return plain objects, not Mongoose documents
```

**2. Lean Queries (Return Plain Objects)**

```javascript
// Before: Mongoose documents with methods (slower)
const devices = await Device.find({});

// After: Plain JavaScript objects (faster, less memory)
const devices = await Device.find({}).lean();
```

**Memory Savings**: ~40% reduction per document

**3. Cursor Streaming (Large Result Sets)**

```javascript
// Before: Load all devices into memory at once (dangerous for 10,000+ devices)
const devices = await Device.find({}).lean();
for (const device of devices) {
  await processDevice(device);
}

// After: Stream devices one at a time (safe for any size)
const cursor = Device.find({})
  .lean()
  .batchSize(50)  // Fetch 50 at a time from MongoDB
  .cursor();

for await (const device of cursor) {
  await processDevice(device);
}
```

**Benefits**:

- ✅ Constant memory usage regardless of collection size
- ✅ Starts processing immediately (no wait for full query)
- ✅ Can handle millions of documents

**4. Aggregation Pipeline Optimization**

```javascript
// Use $match early to reduce documents processed
pipeline
  .match(filter)                    // Filter first (uses indexes)
  .lookup({ from: "sites", ... })   // Then join
  .project(inclusionProjection)     // Select fields
  .skip(skip)
  .limit(limit)
  .allowDiskUse(true);              // Allow disk for large sorts
```

### Memory Management

#### Cursor-Based Processing

```javascript
// Stream large result sets efficiently
const cursor = Device.find({})
  .lean()                    // Plain objects (not Mongoose docs)
  .batchSize(50)             // Fetch 50 at a time from DB
  .cursor();                 // Return cursor, not array

for await (const device of cursor) {
  // Process one device at a time
  // Memory usage stays constant
}
```

**Memory Profile**:

- Without cursor: 10,000 devices × 2KB = 20MB loaded at once
- With cursor: 50 devices × 2KB = 100KB at a time

#### Garbage Collection Hints

```javascript
// After job completes, hint GC if available
if (global.gc) {
  global.gc();
}
```

**When to Use**: After processing large batches or completing jobs

### External API Rate Limiting

#### ThingSpeak Rate Limits

```javascript
// Respect ThingSpeak API limits
const CONCURRENCY_LIMIT = 5; // Max 5 concurrent requests
const REQUEST_DELAY = 100; // 100ms delay between batches
const REQUEST_TIMEOUT = 30000; // 30 second timeout per request
```

**Why These Limits?**

- ThingSpeak: ~100 requests/minute per API key
- 5 concurrent × 12 batches/minute = 60 requests/minute (safe margin)

#### Timeout Protection

```javascript
// Race between actual request and timeout
const data = await Promise.race([
  fetchThingspeakData(channel, apiKey),
  new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout")), 30000)
  ),
]);
```

**Benefits**:

- Prevents hanging on slow APIs
- Allows job to continue with other devices
- Tracks failures for debugging

### Bulk Write Optimization

#### Atomic Batch Updates

```javascript
// Update 500 devices in single database round-trip
const bulkOps = devices.map((device) => ({
  updateOne: {
    filter: { _id: device._id },
    update: { $set: { isOnline: device.newStatus } },
  },
}));

await Device.bulkWrite(bulkOps, {
  ordered: false, // Continue even if some updates fail
});
```

**Performance Gain**:

- Individual updates: 500 × 5ms = 2,500ms
- Bulk write: 1 × 150ms = 150ms
- **Speedup: 16.7x faster**

#### Ordered vs Unordered

```javascript
// Ordered: false (recommended for jobs)
{
  ordered: false;
}
// ✅ Continues on errors
// ✅ Faster (parallel execution)
// ✅ Some updates succeed even if others fail

// Ordered: true (use for transactions)
{
  ordered: true;
}
// ❌ Stops on first error
// ❌ Slower (sequential execution)
// ✅ All-or-nothing guarantee
```

### Performance Metrics

Track job performance:

```javascript
📊 Job Performance Report:
   Execution Time: 7.2s
   Devices Processed: 1,245
   Throughput: 173 devices/second
   Memory Peak: 85MB
   Database Queries: 12
   Bulk Writes: 3
   Yield Count: 124

   Batch Statistics:
   ├─ New Data: 1,180
   ├─ Re-evaluations: 45
   ├─ Out-of-order: 15
   └─ Invalid PM2.5: 5
```

---

## Mobile vs Static Device Handling

### Device Classification Logic

A device is classified based on multiple fields with specific precedence rules:

#### Mobile Device Criteria

A device is considered **mobile** if **ANY** of these are true:

```javascript
mobility === true;
deployment_type === "mobile";
grid_id !== null; // Grid-based deployment
```

#### Static Device Criteria

A device is considered **static** if **ALL** of these are true:

```javascript
mobility === false;
deployment_type === "static";
site_id !== null; // Site-based deployment
```

### Automatic Field Synchronization

The system automatically synchronizes related fields:

```javascript
// Pre-save hook logic
if (mobility === true) {
  deployment_type = "mobile"; // Auto-set
  site_id = undefined; // Auto-clear (mobile can't have site)
  mountType = "vehicle"; // Auto-set (required for mobile)
  powerType = "alternator"; // Auto-set (required for mobile)
} else if (mobility === false) {
  deployment_type = "static"; // Auto-set
  grid_id = undefined; // Auto-clear (static can't have grid)
}
```

### Status Update Behavior by Device Type

| Device Type         | Raw Job Updates                  | Calibrated Job Updates    | Threshold | Data Source     |
| ------------------- | -------------------------------- | ------------------------- | --------- | --------------- |
| **Static Deployed** | `rawOnlineStatus` only           | `isOnline` (primary)      | 5 hours   | Calibrated data |
| **Mobile**          | `rawOnlineStatus` AND `isOnline` | May skip (no site filter) | 1 hour    | Raw data only   |
| **Non-Deployed**    | `rawOnlineStatus` AND `isOnline` | Skipped                   | 1 hour    | Raw data only   |

### Why Different Thresholds?

| Device Type           | Threshold | Rationale                                                                        |
| --------------------- | --------- | -------------------------------------------------------------------------------- |
| **Static (Deployed)** | 5 hours   | Allows time for cloud calibration processing; higher quality data worth the wait |
| **Mobile**            | 1 hour    | Moves between locations, making calibrated data unreliable; needs fast detection |
| **Non-Deployed**      | 1 hour    | Testing/development phase; raw data sufficient; faster issue detection           |

### Status Field Priority Rules

#### For Deployed Static Devices (status = "deployed")

```javascript
// Raw Status Job (:35)
rawOnlineStatus = (lastRawData < 1 hour ago)  // Always updated

// Calibrated Status Job (:45)
isOnline = (lastActive < 5 hours ago)          // Primary status
```

**Dashboard Display**: Shows `isOnline` (calibrated status)

#### For Mobile Devices (mobility = true)

```javascript
// Raw Status Job (:35)
rawOnlineStatus = (lastRawData < 1 hour ago)  // Updated
isOnline = (lastRawData < 1 hour ago)          // ALSO updated

// Calibrated Status Job (:45)
// Likely skipped (no site_id in filter)
```

**Dashboard Display**: Shows `isOnline` (based on raw data)

#### For Non-Deployed Devices (status ∈ ["not deployed", "ready", "testing"])

```javascript
// Raw Status Job (:35)
rawOnlineStatus = (lastRawData < 1 hour ago)  // Updated
isOnline = (lastRawData < 1 hour ago)          // ALSO updated

// Calibrated Status Job (:45)
// Skipped (no site_id)
```

**Dashboard Display**: Shows `isOnline` (based on raw data)

### Location Reference Rules

| Device Type | Required Field | Prohibited Field       | Validation             |
| ----------- | -------------- | ---------------------- | ---------------------- |
| **Mobile**  | `grid_id`      | `site_id` must be null | Pre-save hook enforces |
| **Static**  | `site_id`      | `grid_id` must be null | Pre-save hook enforces |

**Example Error**:

```javascript
// ❌ Invalid: Mobile device with site_id
{
  mobility: true,
  site_id: "site_123",  // Error: mobile devices can't have sites
  grid_id: "grid_456"
}

// ✅ Valid: Mobile device with grid_id
{
  mobility: true,
  grid_id: "grid_456",
  mountType: "vehicle",
  powerType: "alternator"
}
```

### Mobile Device Requirements

Mobile devices have additional mandatory fields:

```javascript
// Required for mobile devices
{
  mobility: true,
  deployment_type: "mobile",
  mountType: "vehicle",        // Must be "vehicle"
  powerType: "alternator",     // Must be "alternator"
  grid_id: ObjectId,           // Required

  // Optional but recommended
  mobility_metadata: {
    route_id: "route_001",
    coverage_area: "kampala_central",
    operational_hours: "6am-10pm",
    movement_pattern: "fixed_route",
    max_speed: 60,
    typical_locations: ["location1", "location2"]
  }
}
```

### Device Categories (Computed Field)

The system computes a `device_categories` object for each device:

```javascript
device_categories: {
  // Primary classification
  primary_category: "lowcost",          // Equipment type: lowcost, bam, gas
  deployment_category: "mobile",         // Deployment: mobile, static

  // Boolean flags for easy filtering
  is_mobile: true,
  is_static: false,
  is_lowcost: true,
  is_bam: false,
  is_gas: false,

  // Combined categories
  all_categories: ["lowcost", "mobile"],

  // Hierarchical structure
  category_hierarchy: [
    {
      level: "equipment",
      category: "lowcost",
      description: "Low-cost sensor device"
    },
    {
      level: "deployment",
      category: "mobile",
      description: "Mobile deployment (vehicle-mounted, grid-based)"
    }
  ],

  // Relationships
  category_relationships: {
    note: "Mobile devices can belong to any equipment category",
    mobile_is_subcategory_of: "lowcost"
  }
}
```

### Query Examples

#### Find All Mobile Devices

```javascript
// Option 1: Using mobility field
db.devices.find({ mobility: true });

// Option 2: Using deployment_type
db.devices.find({ deployment_type: "mobile" });

// Option 3: Using computed categories
db.devices.find({ "device_categories.is_mobile": true });
```

#### Find Mobile BAM Devices

```javascript
db.devices.find({
  mobility: true,
  category: "bam",
});
```

#### Find Deployed Lowcost Devices

```javascript
db.devices.find({
  mobility: false,
  category: "lowcost",
  status: "deployed",
});
```

---

## Uptime vs. Status

### Different Concepts

| Metric     | What It Measures        | Timeframe         | Use Case                            |
| ---------- | ----------------------- | ----------------- | ----------------------------------- |
| **Status** | Current connectivity    | Right now         | "Is the device working now?"        |
| **Uptime** | Historical availability | Days/weeks/months | "How reliable has the device been?" |

### Uptime Calculation

```
Uptime % = (Data Points Received / Expected Data Points) × 100%
```

**Example:**

- Expected: 30 readings/hour × 24 hours = 720 readings/day
- Received: 648 readings
- **Uptime: 90%** (648/720 × 100)

**Threshold Options:**

- 30 readings/hour - Standard (every 2 minutes)
- 60 readings/hour - High frequency (every minute)
- Custom thresholds available per deployment

### Status vs Uptime Scenarios

| Scenario                         | Status  | Uptime (24h) | Interpretation                       |
| -------------------------------- | ------- | ------------ | ------------------------------------ |
| Device sending data continuously | Online  | 100%         | Ideal performance                    |
| Device offline for 1 hour today  | Online  | 96%          | Temporary issue, now resolved        |
| Device offline right now         | Offline | 95%          | Currently down but historically good |
| Device intermittently connecting | Online  | 60%          | Connectivity issues, currently up    |
| Device not deployed              | Offline | N/A          | Not yet operational                  |

---

## Data Aggregation Levels

Our system calculates uptime and status at multiple levels:

### 1. Device Level

- **Scope**: Individual device status and uptime
- **Granularity**: Most detailed view
- **Used for**:
  - Device diagnostics
  - Maintenance planning
  - Individual performance tracking
  - Troubleshooting specific issues

**Example Query**:

```javascript
db.devices.findOne(
  { name: "aq_001" },
  {
    isOnline: 1,
    rawOnlineStatus: 1,
    lastActive: 1,
    onlineStatusAccuracy: 1,
  }
);
```

### 2. Site Level

- **Scope**: Average of all devices at a location
- **Granularity**: Geographic site aggregation
- **Used for**:
  - Site performance monitoring
  - Location-based alerts
  - Comparative analysis across sites
  - Resource allocation decisions

**Calculation**:

```javascript
site.isOnline = primaryDevice.isOnline;
site.uptime = average(allDevicesAtSite.uptime);
```

### 3. Network Level (AirQloud/Grid/Cohort)

- **Scope**: Average across multiple sites/devices
- **Granularity**: Logical networks
- **Used for**:
  - Network health dashboards
  - Regional analysis
  - High-level KPI reporting
  - Executive summaries

**Calculation**:

```javascript
network.uptime = average(allSitesInNetwork.uptime);
network.onlineDevices = count(devices.where(isOnline: true));
network.totalDevices = count(allDevicesInNetwork);
```

### Aggregation Example

```
City Network (AirQloud: "Kampala Central")
├── Site A: 95% uptime, Online
│   ├── Device 1 (Primary): 98% uptime, Online
│   └── Device 2: 92% uptime, Online
│
├── Site B: 88% uptime, Offline
│   ├── Device 3 (Primary): 85% uptime, Offline
│   └── Device 4: 91% uptime, Online
│
└── Network Average: 91.5% uptime
    Online Sites: 1/2 (50%)
    Online Devices: 3/4 (75%)
```

### Aggregation Pipeline Example

```javascript
// Get network-level statistics
db.devices.aggregate([
  // Filter by network
  {
    $match: {
      network: "airqo",
      status: "deployed",
    },
  },

  // Join with sites
  {
    $lookup: {
      from: "sites",
      localField: "site_id",
      foreignField: "_id",
      as: "site",
    },
  },

  // Group by AirQloud
  {
    $group: {
      _id: "$site.airqloud_id",
      totalDevices: { $sum: 1 },
      onlineDevices: {
        $sum: { $cond: ["$isOnline", 1, 0] },
      },
      avgUptime: { $avg: "$uptime_percentage" },
    },
  },

  // Calculate network health
  {
    $project: {
      airqloud_id: "$_id",
      totalDevices: 1,
      onlineDevices: 1,
      availability: {
        $multiply: [{ $divide: ["$onlineDevices", "$totalDevices"] }, 100],
      },
      avgUptime: { $round: ["$avgUptime", 2] },
    },
  },
]);
```

---

## Key Performance Indicators

### Target Metrics

| Metric            | Target | Good | Needs Attention |
| ----------------- | ------ | ---- | --------------- |
| Device Uptime     | ≥95%   | ≥90% | <90%            |
| Status Accuracy   | ≥98%   | ≥95% | <95%            |
| Data Completeness | ≥95%   | ≥90% | <90%            |
| Network Uptime    | ≥90%   | ≥85% | <85%            |

### What These Mean

#### Device Uptime ≥95%

- **Definition**: Device transmitting data 95% of expected time
- **Indicates**: Reliable hardware and connectivity
- **Normal gaps**: Maintenance, power issues, network outages
- **Calculation**: Over 24-hour or 7-day rolling window

**Example**:

```
Expected: 720 readings/day (30/hour × 24 hours)
Received: 684 readings
Uptime: 95% ✅ Meets target
```

#### Status Accuracy ≥98%

- **Definition**: System correctly identifies device state 98% of the time
- **Indicates**: Reliable monitoring system
- **High accuracy**: Shows system effectively tracks device health
- **Tracks**: Correctness of online/offline determinations

**Example**:

```
Total checks today: 24 (hourly)
Correct checks: 24
Incorrect checks: 0
Accuracy: 100% ✅ Exceeds target
```

#### Data Completeness ≥95%

- **Definition**: Receiving 95%+ of expected data points
- **Indicates**: Good sensor operation
- **Missing data**: May indicate sensor or transmission issues
- **Differs from uptime**: Focuses on data quality, not just connectivity

**Example**:

```
Expected measurements: 1440/day (every minute)
Received measurements: 1368
Completeness: 95% ✅ Meets target
```

#### Network Uptime ≥90%

- **Definition**: Overall network performing well
- **Aggregate view**: Some individual devices may underperform
- **Calculation**: Average of all devices/sites in network
- **Resilient**: Network stays healthy despite individual failures

**Example**:

```
Network: "Kampala"
Total devices: 50
Online devices: 47
Network availability: 94% ✅ Exceeds target
```

### KPI Monitoring Dashboard

```
📊 AirQo Network Health (Last 24 Hours)

Device Performance:
├─ Total Devices: 1,245
├─ Online: 1,187 (95.3%) ✅
├─ Offline: 58 (4.7%)
└─ Avg Uptime: 96.2% ✅

Status Accuracy:
├─ Total Checks: 29,880
├─ Correct: 29,282 (98.0%) ✅
├─ Incorrect: 598 (2.0%)
└─ Trending: +0.2% (improving)

Data Quality:
├─ Expected Points: 1,795,200
├─ Received Points: 1,706,440 (95.1%) ✅
├─ Invalid PM2.5: 2,450 (0.1%)
└─ Completeness: 95.1% ✅

Network Summary:
├─ Total Sites: 285
├─ Active Sites: 267 (93.7%) ✅
├─ Network Uptime: 93.7% ✅
└─ Status: Healthy
```

---

## Business Impact

### Why Accuracy Matters

#### Operational Efficiency

- **Accurate status** → Faster response to device failures
- **Reduced false positives** → Fewer unnecessary field visits
- **Improved scheduling** → Maintenance planned based on real data
- **Resource optimization** → Field technicians deployed effectively

**ROI Example**:

```
False Positive Rate: 2% (accurate system)
Field visits avoided: 50 per month
Cost per visit: $50
Monthly savings: $2,500
Annual savings: $30,000
```

#### Data Quality

- **Higher accuracy** → More reliable air quality data
- **Builds trust** → Data consumers have confidence
- **Regulatory compliance** → Meets data quality standards
- **Research value** → Academic and policy research enabled

**Impact Metrics**:

- **Data uptime** → 98% vs industry average 85%
- **Data completeness** → 95% vs industry average 80%
- **Calibration accuracy** → ±10% vs ±25% (low-cost sensors)

#### Cost Management

- **Quick identification** → Problematic devices spotted fast
- **Optimized allocation** → Resources directed to real issues
- **Reduced downtime** → Issues resolved before critical
- **Lower operational costs** → Preventive vs reactive maintenance

**Cost Comparison**:
| Scenario | Reactive Approach | Proactive Approach (Accurate Status) |
|----------|------------------|-------------------------------------|
| Issue detection | 2-7 days | <1 hour |
| Data loss | 48-168 hours | 1-2 hours |
| Field visit cost | $100 (urgent) | $50 (scheduled) |
| Device downtime | $500/week | $50/week |

### Cost of Inaccuracy

| Scenario                                                 | Impact                   | Cost                                              |
| -------------------------------------------------------- | ------------------------ | ------------------------------------------------- |
| **False Positive** (shows connected but isn't)           | Delayed issue detection  | Data gaps, missed alerts, 2-7 days downtime       |
| **False Negative** (shows disconnected but is connected) | Unnecessary field visits | Wasted technician time, \$50-100 per visit        |
| **Systematic Errors**                                    | Loss of confidence       | Stakeholder trust issues, data credibility damage |

#### False Positive Deep Dive

**Scenario**: Device shows online but stopped transmitting

```
Day 1: Device goes offline
       System still shows: Online ❌
       Impact: No alert sent

Day 3: Stakeholder notices missing data
       Impact: Issue escalated, urgency increased

Day 5: Field visit (expedited)
       Cost: $150 (urgent rate)
       Data loss: 120 hours
       Estimated data value: $500

Total Cost: $650 + reputational damage
```

#### False Negative Deep Dive

**Scenario**: Device is online but system shows offline

```
Hour 0: Status incorrectly shows offline
        Alert sent to field team

Hour 2: Technician dispatched
        Cost: $50 (travel + time)

Hour 4: Technician arrives, finds device working
        Impact: Wasted 4 hours
        Opportunity cost: Other maintenance delayed

Total Cost: $100 (direct) + $50 (opportunity cost)
```

---

## How to Read Accuracy Reports

### Sample Report Interpretation

```
Device: aq_device_001
Total Checks: 8,760 (24 checks/day × 365 days)
Correct: 8,584
Incorrect: 176
Accuracy: 98%
```

**What This Tells Us:**

- ✅ Device monitoring is highly reliable (98%)
- ✅ Only 176 misclassifications in a full year
- ✅ Meets target accuracy threshold (≥98%)
- 📊 System is performing as expected
- 📈 Average of 0.48 errors per day (176/365)

### Detailed Accuracy Breakdown

```javascript
{
  device_id: "aq_device_001",
  onlineStatusAccuracy: {
    // Core metrics
    totalChecks: 8760,
    correctChecks: 8584,
    incorrectChecks: 176,
    accuracyPercentage: 98.0,

    // Timestamps
    lastCheck: "2024-11-16T12:45:00Z",
    lastCorrectCheck: "2024-11-16T12:45:00Z",
    lastIncorrectCheck: "2024-11-10T08:30:00Z",

    // Failure analysis
    lastIncorrectReason: "fetch_error",

    // Legacy fields (backward compatibility)
    totalAttempts: 8760,
    successfulUpdates: 8584,
    failedUpdates: 176,
    successPercentage: 98.0,
    failurePercentage: 2.0
  }
}
```

### Interpreting Accuracy Percentages

| Accuracy   | Status    | Interpretation             | Action                    |
| ---------- | --------- | -------------------------- | ------------------------- |
| **≥99%**   | Excellent | System tracking perfectly  | None required             |
| **98-99%** | Very Good | Minor issues, meets target | Monitor for trends        |
| **95-98%** | Good      | Acceptable, some issues    | Review failure reasons    |
| **90-95%** | Fair      | Needs attention            | Investigate and address   |
| **<90%**   | Poor      | Critical issues            | Immediate action required |

### Red Flags to Watch For

#### 1. Low Accuracy (<95%)

**Symptoms**:

```
Device: aq_device_042
Accuracy: 88% ⚠️
Incorrect Checks: 1,051 / 8,760
Last Incorrect: 2 hours ago
```

**Possible Causes**:

- Intermittent connectivity issues
- Data processing delays
- Hardware problems (sensor, modem)
- Threshold misconfiguration
- Network infrastructure issues

**Investigation Steps**:

```bash
# 1. Check failure reasons
db.devices.findOne(
  { name: "aq_device_042" },
  { "onlineStatusAccuracy.lastIncorrectReason": 1 }
)

# 2. Review recent activity logs
db.activities.find({
  device: "aq_device_042",
  createdAt: { $gte: ISODate("2024-11-01") }
}).sort({ createdAt: -1 })

# 3. Check raw vs calibrated status
db.devices.findOne(
  { name: "aq_device_042" },
  { isOnline: 1, rawOnlineStatus: 1, lastActive: 1, lastRawData: 1 }
)

# 4. Analyze failure patterns
db.devices.aggregate([
  { $match: { name: "aq_device_042" } },
  { $project: {
      hoursSinceLastCorrect: {
        $divide: [
          { $subtract: [new Date(), "$onlineStatusAccuracy.lastCorrectCheck"] },
          3600000
        ]
      }
  }}
])
```

**Action**:

- Schedule maintenance check
- Review device logs
- Test connectivity
- Verify ThingSpeak configuration

#### 2. Declining Trend

**Symptoms**:

```
Week 1: 98% ✅
Week 2: 96% ⚠️
Week 3: 94% ⚠️
Week 4: 91% 🚨
```

**Indicates**:

- Degrading hardware (sensor, modem)
- Worsening connectivity
- Power supply issues
- Environmental factors (weather, obstruction)

**Analysis Query**:

```javascript
// Track accuracy over time
db.devices.aggregate([
  { $match: { name: "aq_device_042" } },
  {
    $project: {
      name: 1,
      currentAccuracy: "$onlineStatusAccuracy.accuracyPercentage",
      daysSinceLastIncorrect: {
        $divide: [
          {
            $subtract: [new Date(), "$onlineStatusAccuracy.lastIncorrectCheck"],
          },
          86400000,
        ],
      },
    },
  },
]);
```

**Action**:

- Schedule immediate maintenance
- Prepare replacement device
- Document failure pattern
- Update maintenance schedule

#### 3. Recurring Incorrect Reasons

**Symptoms**:

```
Last 10 incorrect checks:
├─ fetch_error: 6 times
├─ timeout: 3 times
└─ decryption_failed: 1 time

Pattern: fetch_error dominates
```

**Root Cause Analysis**:

```javascript
// Group failures by reason
db.devices.aggregate([
  {
    $match: {
      "onlineStatusAccuracy.incorrectChecks": { $gt: 0 },
    },
  },
  {
    $group: {
      _id: "$onlineStatusAccuracy.lastIncorrectReason",
      count: { $sum: "$onlineStatusAccuracy.incorrectChecks" },
      devices: { $push: "$name" },
    },
  },
  { $sort: { count: -1 } },
]);
```

**Common Patterns & Solutions**:

| Reason              | Common Cause             | Solution                    |
| ------------------- | ------------------------ | --------------------------- |
| `fetch_error`       | ThingSpeak API issues    | Retry logic, backup API key |
| `timeout`           | Slow network             | Increase timeout, check ISP |
| `no_readkey`        | Missing configuration    | Update device credentials   |
| `decryption_failed` | Corrupted encryption key | Re-encrypt keys             |
| `invalid_timestamp` | Clock skew               | NTP sync, device reboot     |

#### 4. All Devices in Area Affected

**Symptoms**:

```
Site: Kampala Central
├─ Device 1: 85% accuracy ⚠️
├─ Device 2: 82% accuracy ⚠️
├─ Device 3: 88% accuracy ⚠️
└─ Device 4: 84% accuracy ⚠️

Pattern: All devices at same site affected
```

**Indicates**:

- Network infrastructure issue
- Power supply problem
- Environmental interference
- Site-level connectivity issue

**Investigation**:

```javascript
// Check site-level patterns
db.devices.aggregate([
  {
    $lookup: {
      from: "sites",
      localField: "site_id",
      foreignField: "_id",
      as: "site",
    },
  },
  {
    $match: {
      "site.name": "Kampala Central",
      "onlineStatusAccuracy.accuracyPercentage": { $lt: 90 },
    },
  },
  {
    $project: {
      name: 1,
      accuracy: "$onlineStatusAccuracy.accuracyPercentage",
      lastIncorrect: "$onlineStatusAccuracy.lastIncorrectCheck",
    },
  },
]);
```

**Action**:

- Site visit to check infrastructure
- Test network connectivity
- Verify power supply
- Check for physical obstructions

### Accuracy Trends Dashboard

```
📊 System-Wide Accuracy Report (Last 30 Days)

Overall Accuracy: 97.8% ✅
├─ Target: ≥98%
├─ Status: Slightly Below Target
└─ Trend: Stable

Device Breakdown:
├─ Excellent (≥99%): 892 devices (71.6%)
├─ Very Good (98-99%): 245 devices (19.7%)
├─ Good (95-98%): 78 devices (6.3%)
├─ Fair (90-95%): 22 devices (1.8%)
└─ Poor (<90%): 8 devices (0.6%) 🚨

Top Failure Reasons:
├─ fetch_error: 1,245 occurrences (45%)
├─ timeout: 678 occurrences (24%)
├─ invalid_timestamp: 456 occurrences (16%)
├─ network_latency: 234 occurrences (8%)
└─ other: 187 occurrences (7%)

Geographic Distribution:
├─ Kampala: 98.5% ✅
├─ Entebbe: 97.2% ⚠️
├─ Jinja: 96.8% ⚠️
└─ Mbarara: 99.1% ✅

Recommendations:
🔧 8 devices require immediate maintenance
📡 Entebbe network infrastructure needs review
🔍 Investigate timeout issues in Jinja region
```

---

## System Reliability Features

### Built-in Safeguards

#### Timestamp Validation

**Rules Enforced**:

```javascript
// 1. Reject future timestamps (with grace period for clock skew)
if (timestamp > now + 5 minutes) {
  reject("future_timestamp");
}

// 2. Reject very old timestamps
if (timestamp < now - (2 × INACTIVE_THRESHOLD)) {
  reject("timestamp_too_old");
}

// 3. Validate timestamp format
if (!isValidDate(timestamp)) {
  reject("invalid_date_format");
}
```

**Benefits**:

- ✅ Prevents data corruption from clock skew
- ✅ Filters out stale data from retries
- ✅ Handles gracefully without crashing

**Example**:

```javascript
Event: { time: "2024-11-16T20:00:00Z" }
Current time: "2024-11-16T12:00:00Z"

Validation:
✅ Is valid date format
❌ Is 8 hours in future
🔄 Rejected with reason: "future_timestamp"
📊 Accuracy tracked: incorrectChecks++
```

#### Out-of-Order Handling

**Strategy**: Compare timestamps before updating

```javascript
// Only update if new timestamp is actually newer
const filter = {
  _id: deviceId,
  $or: [
    { lastActive: { $lt: newTimestamp } },
    { lastActive: { $exists: false } },
  ],
};

await Device.updateOne(filter, { $set: { lastActive: newTimestamp } });
```

**Guarantees**:

- ✅ Time never goes backward
- ✅ Latest data always wins
- ✅ No race conditions between concurrent updates

**Test Case**:

```
T1: Update with time=10:00 → lastActive=10:00 ✅
T2: Update with time=10:05 → lastActive=10:05 ✅ (10:05 > 10:00)
T3: Update with time=10:02 → lastActive=10:05 ❌ (10:02 < 10:05)
```

#### Graceful Degradation

**Timeout Protection**:

```javascript
MAX_EXECUTION_TIME = 15 minutes (calibrated job)
MAX_EXECUTION_TIME = 10 minutes (raw status job)

// Check before each batch
if (Date.now() - startTime > MAX_EXECUTION_TIME) {
  logger.warn("Job timeout, stopping gracefully");
  return; // Exit cleanly
}
```

**Partial Success Model**:

```javascript
// Use unordered bulk writes
bulkWrite(operations, { ordered: false });

// Results:
// ✅ Some operations succeed
// ❌ Some operations fail
// ✅ Successful operations are committed
// ✅ Next run will catch failed operations
```

**Benefits**:

- ✅ Job doesn't block indefinitely
- ✅ Partial progress is saved
- ✅ System remains operational during issues
- ✅ Next execution catches missed items

**Example**:

```
Job start: 12:45:00
Processing: 1,000 devices

12:45:00 - Batch 1: 500 devices ✅
12:52:00 - Batch 2: 500 devices ✅
12:59:00 - Batch 3: Starting...
13:00:00 - Timeout reached, stopping

Result:
✅ 1,000 devices updated
❌ Batch 3 incomplete
🔄 Next run (13:45) will process Batch 3
```

#### Race Condition Prevention

**Cache Update Protection**:

```javascript
// Only update cache if newer than existing
if (!existingCache || newTimestamp > existingCache.timestamp) {
  cache.set(key, {
    data: newData,
    timestamp: newTimestamp,
  });
}
```

**Atomic Database Operations**:

```javascript
// Use atomic operations for counters
$inc: { "onlineStatusAccuracy.totalChecks": 1 }

// Not this (race condition):
accuracy.totalChecks++;
await device.save();
```

**Benefits**:

- ✅ Consistent state maintenance
- ✅ No lost updates
- ✅ Safe concurrent access

#### Error Recovery

**Individual Batch Failure Doesn't Stop Job**:

```javascript
try {
  await processBatch(devices);
} catch (error) {
  logger.error(`Batch failed: ${error.message}`);
  // Continue with next batch
  continue;
}
```

**External API Timeout**:

```javascript
const result = await Promise.race([
  fetchThingspeakData(channel, apiKey),
  timeout(30000, "ThingSpeak timeout"),
]);
```

**Database Connection Retry**:

```javascript
await asyncRetry(
  async () => {
    return await Device.bulkWrite(operations);
  },
  {
    retries: 3,
    minTimeout: 1000,
    maxTimeout: 5000,
  }
);
```

---

## Monitoring & Alerts

### What Gets Reported

#### Hourly Job Reports

**Calibrated Status Job (:45)**:

```
📊 Calibrated Status Report - 12:45 EAT
   Duration: 7.2s
   Devices processed: 1,245
   Status updates: 1,180
   Accuracy updates: 1,245
   Offline devices: 65
   Stale entities: 12

   Batch Statistics:
   ├─ New data: 1,180
   ├─ Re-evaluations: 45
   ├─ Out-of-order: 15
   └─ Invalid PM2.5: 5
```

**Raw Status Job (:35)**:

```
📊 Raw Status Report - 12:35 EAT
   Duration: 8.5s
   Devices processed: 1,245
   ThingSpeak API calls: 1,245
   Successful fetches: 1,210
   Timeouts: 25
   Errors: 10

   Status Updates:
   ├─ Raw status: 1,245
   ├─ Primary status (mobile): 345
   └─ Site updates: 890
```

#### Daily Summary (12 PM EAT)

```
📊 Daily Report: 12:00 PM EAT - 2024-11-16

   Processing Time: 45s

   Device Status:
   ├─ Total: 1,245
   ├─ Online: 1,187 (95.3%) ✅
   ├─ Offline: 58 (4.7%)
   └─ Status changes: 23

   Site Status:
   ├─ Total: 285
   ├─ Active: 267 (93.7%) ✅
   ├─ Inactive: 18 (6.3%)
   └─ Status changes: 5

   Accuracy:
   ├─ System-wide: 97.8% ⚠️
   ├─ Devices >98%: 1,137 (91.3%)
   ├─ Devices <95%: 30 (2.4%)
   └─ Trend: Stable

   Issues:
   🚨 8 devices require maintenance (accuracy <90%)
   ⚠️ 22 devices below target (accuracy 90-95%)
   📡 25 ThingSpeak timeouts (2% of requests)
```

**Translation**:

- **45s**: Total job execution time
- **350↑**: 350 devices updated to connected status
- **15↓**: 15 devices marked as disconnected
- **85↑**: 85 sites with active devices
- **3↓**: 3 sites with all devices offline

### Alert Types

#### Critical Alerts (Immediate Action)

```
🚨 CRITICAL: Device Offline
   Device: aq_device_042
   Location: Kampala Central
   Offline since: 2024-11-16 08:00
   Duration: 4 hours
   Expected uptime: >95%
   Current uptime: 85%
   Action: Dispatch technician
```

```
🚨 CRITICAL: Network Degradation
   Network: Kampala Region
   Affected devices: 25/100 (25%)
   Average accuracy: 82% (target: 98%)
   Started: 2024-11-16 06:00
   Action: Investigate network infrastructure
```

#### Warning Alerts (Monitor Closely)

```
⚠️ WARNING: Accuracy Declining
   Device: aq_device_042
   Current accuracy: 94% (target: 98%)
   Trend: -1% per week
   Projection: Will reach critical (<90%) in 4 weeks
   Action: Schedule maintenance
```

```
⚠️ WARNING: High Error Rate
   ThingSpeak API errors: 15% (last hour)
   Normal rate: <2%
   Affected devices: 187
   Action: Monitor API status
```

#### Info Alerts (Awareness)

```
ℹ️ INFO: Device Recovered
   Device: aq_device_042
   Was offline: 2 hours
   Now online: Since 2024-11-16 10:00
   Accuracy: 98%
   Action: None required
```

```
ℹ️ INFO: Maintenance Window
   Scheduled: 2024-11-17 02:00-04:00
   Expected offline: 50 devices
   Impact: Kampala Central site
   Action: Suppress alerts during window
```

### Monitoring Dashboard

```
🖥️ AirQo Device Status Dashboard - Live

System Health: ✅ Healthy
└─ Last update: 2 minutes ago

Real-Time Status:
├─ Online devices: 1,187 / 1,245 (95.3%)
├─ Offline devices: 58 (4.7%)
├─ Status checks/hour: 1,245
└─ Average response time: 145ms

Accuracy Metrics:
├─ System-wide: 97.8% ⚠️
├─ Calibrated job: 98.2% ✅
├─ Raw status job: 97.4% ⚠️
└─ Trend: Stable (+0.1% this week)

Active Issues:
🚨 Critical: 8 devices
⚠️ Warning: 22 devices
ℹ️ Info: 5 recovered devices

Geographic Distribution:
├─ Kampala: 95.8% online ✅
├─ Entebbe: 94.2% online ✅
├─ Jinja: 93.5% online ⚠️
└─ Mbarara: 96.1% online ✅

Recent Activity:
├─ 13:45 - Calibrated status job completed (7.2s)
├─ 13:35 - Raw status job completed (8.5s)
├─ 13:30 - Device aq_042 recovered
└─ 13:15 - Device aq_156 went offline
```

---

## Error Handling & Recovery

### Timeout Protection

Both jobs have maximum execution times to prevent indefinite hangs:

**Configuration**:

```javascript
// Calibrated Status Job
MAX_EXECUTION_TIME = 15 * 60 * 1000; // 15 minutes

// Raw Status Job
MAX_EXECUTION_TIME = 10 * 60 * 1000; // 10 minutes
```

**What Happens on Timeout?**

1. **Job Stops Processing New Items**

   ```javascript
   if (Date.now() - startTime > MAX_EXECUTION_TIME) {
     logger.warn("Job timeout, stopping gracefully");
     break; // Exit processing loop
   }
   ```

2. **Partial Updates ARE Preserved**

   ```javascript
   // Using unordered bulk writes
   await Device.bulkWrite(operations, { ordered: false });

   // Result: Successful operations committed even if job stops
   ```

3. **Next Hour's Run Catches Missed Devices**

   - Jobs are idempotent (safe to run multiple times)
   - Missed devices will be processed in next execution
   - No data corruption from incomplete runs

4. **Metrics Are Logged**
   ```
   ⚠️ Job timeout after 15 minutes
      Processed: 1,000 / 1,245 devices
      Successful: 980
      Failed: 20
      Remaining: 245 (will be processed next run)
   ```

**Timeout Recovery Example**:

```
12:45 - Job starts (1,245 devices to process)
12:58 - Processed 1,000 devices ✅
13:00 - Timeout reached, job stops
        └─ 1,000 devices updated
        └─ 245 devices skipped

13:45 - Next job run
        └─ All 1,245 devices processed
        └─ 245 "skipped" devices caught up
```

###
