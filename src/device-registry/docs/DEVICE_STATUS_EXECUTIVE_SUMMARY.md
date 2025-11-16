# AirQo Device Status & Monitoring System

### Purpose

This document explains how our automated system tracks device connectivity status and measures the accuracy of those determinations. It's designed for team members who need to understand the system without diving into technical implementation details.

---

## What We Monitor

### Device Status

We track whether each device is currently online (transmitting data) or offline (not transmitting).

**Two Status Types**:

| Status Type         | What It Shows                | Updated When                         |
| ------------------- | ---------------------------- | ------------------------------------ |
| **isOnline**        | Primary device status        | Every hour at :45 (deployed devices) |
| **rawOnlineStatus** | Raw data transmission status | Every hour at :35 (all devices)      |

### Why Two Status Types?

- **rawOnlineStatus**: Fast detection using direct device transmissions
- **isOnline**: Higher quality determination using processed, calibrated data

Different device types use different status fields as their primary indicator.

---

## How Status is Determined

### Simple Logic

The system checks: **"Has the device sent data recently?"**

- **Yes** (within threshold) → Device is Online ✅
- **No** (beyond threshold) → Device is Offline ❌

### Time Thresholds

| Device Type              | Threshold | Why This Duration                           |
| ------------------------ | --------- | ------------------------------------------- |
| **Deployed Devices**     | 5 hours   | Allows time for data calibration processing |
| **Mobile Devices**       | 1 hour    | Uses raw data, needs faster detection       |
| **Non-Deployed Devices** | 1 hour    | Testing phase, uses raw data                |

### Update Schedule

**Every Hour, Two Checks Run**:

**12:35** - Raw Status Job

- Checks ThingSpeak for recent device transmissions
- Updates `rawOnlineStatus` for all devices
- Also updates `isOnline` for mobile and non-deployed devices
- Takes ~8-10 minutes

**12:45** - Calibrated Status Job

- Checks database for recent calibrated measurements
- Updates `isOnline` for deployed devices
- Updates site status based on device data
- Takes ~7-10 minutes

**Result**: Every device is checked 48 times per day (24 hours × 2 jobs)

---

## Accuracy Tracking

### What We Measure

For each status check, we track whether our determination was correct:

```
Current Status: What the system currently shows (e.g., "online")
New Status: What the recent data tells us (e.g., "online")
Match? Yes → Correct check ✅
Match? No → Incorrect check ❌
```

### Accuracy Calculation

```
Accuracy = (Correct Checks / Total Checks) × 100%

Example:
Total checks: 1,000
Correct: 950
Incorrect: 50
Accuracy: 95%
```

### What Gets Tracked

For each device:

- **totalChecks**: How many times we've checked the device
- **correctChecks**: Times our status was right
- **incorrectChecks**: Times our status was wrong
- **accuracyPercentage**: Overall accuracy rate
- **lastCheck**: When we last checked
- **lastIncorrectReason**: Why the last incorrect check failed (e.g., "timeout", "fetch_error")

---

## Current Performance

### Network Status

```
Total Devices: 1,245
Online: 1,187 (95.3%)
Offline: 58 (4.7%)
```

### System Accuracy

```
Overall Accuracy: 97.8%
Target: ≥98%
Status: Slightly below target
```

### Data Completeness

```
Expected Data Points: 100%
Received: 95.1%
Target: ≥95%
Status: Meeting target
```

---

## Device Types & Handling

### Mobile Devices

**Characteristics**:

- Mounted on vehicles
- Move between locations
- Grid-based deployment

**Status Updates**:

- Use raw data (faster, 1-hour threshold)
- Both `isOnline` and `rawOnlineStatus` updated by raw job
- Don't rely on calibrated data (location changes affect calibration)

### Static Deployed Devices

**Characteristics**:

- Fixed location installations
- Site-based deployment
- Permanent monitoring stations

**Status Updates**:

- Use calibrated data (higher quality, 5-hour threshold)
- `isOnline` updated by calibrated job
- `rawOnlineStatus` updated by raw job

### Non-Deployed Devices

**Characteristics**:

- Testing, repairs, or warehouse
- Not yet in field deployment

**Status Updates**:

- Use raw data (1-hour threshold)
- Both status fields updated by raw job
- Faster detection for testing purposes

---

## Common Status Scenarios

### Scenario 1: Device Working Normally

```
Device: aq_device_001
Status: deployed
isOnline: true
lastActive: 2024-11-16 12:30:00 (15 minutes ago)
Accuracy: 98%
```

**What this means**: Device is transmitting data regularly, system is correctly identifying it as online.

### Scenario 2: Device Offline

```
Device: aq_device_042
Status: deployed
isOnline: false
lastActive: 2024-11-16 06:00:00 (6 hours ago)
Accuracy: 97%
```

**What this means**: Device hasn't sent data for 6 hours (beyond 5-hour threshold), correctly marked offline.

### Scenario 3: Recent Recovery

```
Device: aq_device_156
Status: deployed
isOnline: true
lastActive: 2024-11-16 12:40:00 (5 minutes ago)
Previous offline: 2 hours
Accuracy: 98%
```

**What this means**: Device was offline, now back online. System detected recovery in next hourly check.

### Scenario 4: Low Accuracy

```
Device: aq_device_089
Status: deployed
isOnline: true
lastActive: 2024-11-16 12:35:00 (10 minutes ago)
Accuracy: 88%
lastIncorrectReason: "fetch_error"
```

**What this means**: Device is working but system has trouble determining status accurately. May indicate network issues or configuration problems.

---

## Why Checks Might Be Incorrect

### Common Reasons

| Reason                | What It Means                           | Typical Cause                  |
| --------------------- | --------------------------------------- | ------------------------------ |
| **fetch_error**       | Failed to retrieve data from ThingSpeak | API issues, network problems   |
| **timeout**           | Request took too long                   | Slow network, high server load |
| **invalid_timestamp** | Data timestamp failed validation        | Clock skew, corrupted data     |
| **network_latency**   | Data in transit during check            | Timing issue, normal delay     |
| **no_readkey**        | Missing API credentials                 | Configuration issue            |

### Accuracy Improvement Areas

When accuracy drops below 95% for a device, common causes include:

- Intermittent network connectivity
- Data processing delays
- ThingSpeak API instability
- Device hardware issues
- Configuration problems

---

## Data Quality Checks

### PM2.5 Validation

Not all data that arrives gets stored. We validate PM2.5 values:

**Valid PM2.5 Must**:

- Not be null or undefined
- Be a number
- Be between 0 and 1,000 μg/m³

**What Happens to Invalid Values**:

- ❌ Not stored in device's latest PM2.5 reading
- ✅ Device still marked as online (connectivity is separate from data quality)
- 📊 Logged for troubleshooting

### Out-of-Order Events

Sometimes data arrives out of chronological order. The system handles this:

```
10:00 - Device sends Event A (PM2.5: 15)
10:05 - Event A processed → lastActive = 10:00

10:10 - Device sends Event B (PM2.5: 20)
10:12 - Event B processed → lastActive = 10:10

10:15 - Event A arrives again (duplicate)
        → lastActive stays 10:10 (not updated with old timestamp)
        → Accuracy still tracked
```

**Rule**: We only update timestamps if new data is actually newer than what we already have.

---

## Hourly Job Process

### What Happens Each Hour

#### Raw Status Job (:35)

1. Fetch all devices from database
2. For each device with ThingSpeak channel:
   - Request latest data from ThingSpeak
   - Check timestamp of last reading
   - Determine if online (< 1 hour old)
   - Update `rawOnlineStatus`
   - For mobile/non-deployed: Also update `isOnline`
3. Update accuracy metrics
4. Generate report

**Processing**: ~1,245 devices in 8-10 minutes

#### Calibrated Status Job (:45)

1. Fetch recent calibrated events from database
2. Group events by device and site
3. For each deployed device:
   - Check timestamp of latest calibrated data
   - Determine if online (< 5 hours old)
   - Update `isOnline`
4. Update site status based on device data
5. Mark devices as offline if no recent data
6. Update accuracy metrics
7. Generate report

**Processing**: ~1,245 devices in 7-10 minutes

---

## Performance Targets

### What We Aim For

| Metric               | Target | Current | Status       |
| -------------------- | ------ | ------- | ------------ |
| Device Uptime        | ≥95%   | 95.3%   | ✅ Meeting   |
| System Accuracy      | ≥98%   | 97.8%   | ⚠️ Close     |
| Data Completeness    | ≥95%   | 95.1%   | ✅ Meeting   |
| Network Availability | ≥90%   | 93.7%   | ✅ Exceeding |

### Regional Performance

| Region  | Devices | Uptime | Accuracy        |
| ------- | ------- | ------ | --------------- |
| Kampala | 450     | 98.5%  | ✅ Excellent    |
| Entebbe | 125     | 97.2%  | ✅ Good         |
| Jinja   | 89      | 96.8%  | ✅ Good         |
| Mbarara | 67      | 99.1%  | ✅ Excellent    |
| Gulu    | 45      | 94.5%  | ⚠️ Below target |
| Other   | 469     | 93.2%  | ⚠️ Below target |

---

## Daily Operations

### Morning Report (12:00 PM Daily)

Every day at noon, the system generates a summary:

```
📊 Daily Status Report - November 16, 2024

Device Status:
├─ Online: 1,187 (95.3%)
├─ Offline: 58 (4.7%)
└─ Status changes: 23

Site Status:
├─ Active: 267 (93.7%)
├─ Inactive: 18 (6.3%)
└─ Status changes: 5

Accuracy:
├─ System-wide: 97.8%
├─ Devices >98%: 1,137 (91.3%)
└─ Devices <95%: 30 (2.4%)

Attention Needed:
🚨 8 devices require maintenance (accuracy <90%)
⚠️ 22 devices below target (accuracy 90-95%)
```

### Alert Types

**🚨 Critical**: Device offline >4 hours or accuracy <90%
**⚠️ Warning**: Accuracy declining or between 90-95%
**ℹ️ Info**: Device recovered or status update

---

## Key Concepts Summary

### Device Status

- **Online**: Device sent data within threshold period
- **Offline**: No data received within threshold period
- **Threshold**: 1 hour (mobile/testing) or 5 hours (deployed)

### Accuracy

- **Measures**: How often system correctly identifies device status
- **Calculated**: Every status check (48 times per day per device)
- **Target**: ≥98% accuracy
- **Current**: 97.8% system-wide

### Jobs

- **Raw Status Job**: Runs at :35, checks ThingSpeak, 1-hour threshold
- **Calibrated Status Job**: Runs at :45, checks calibrated data, 5-hour threshold
- **Frequency**: Every hour, 24/7

### Device Types

- **Mobile**: Vehicle-mounted, uses raw data, 1-hour threshold
- **Static Deployed**: Fixed location, uses calibrated data, 5-hour threshold
- **Non-Deployed**: Testing/warehouse, uses raw data, 1-hour threshold

---

## Frequently Asked Questions

### Q: Why do we check devices twice per hour?

**A**: Two different data sources with different purposes:

- **Raw data** (ThingSpeak): Fast detection, all devices
- **Calibrated data** (Database): Higher quality, deployed devices only

### Q: What does 97.8% accuracy mean?

**A**: Out of every 100 status checks, approximately 98 are correct. We're tracking whether the system accurately identifies if a device is online or offline.

### Q: Why 5 hours for deployed devices but 1 hour for mobile?

**A**:

- **5 hours**: Calibrated data takes time to process (1-4 hours), so we allow longer
- **1 hour**: Raw data is immediate, and mobile devices need faster detection

### Q: What happens when a device goes offline?

**A**:

1. System detects in next hourly check (within 1 hour)
2. Status updated to offline
3. Accuracy tracked
4. Alert generated if device was previously online
5. Operations team notified

### Q: Can accuracy be 100%?

**A**: In practice, no. There will always be some edge cases:

- Brief network outages during checks
- Data processing delays
- Timing issues between device transmission and status check
- External API instability

Target of 98% accounts for these unavoidable issues.

### Q: How is this different from device uptime?

**A**:

- **Status**: Is the device online right now? (current moment)
- **Uptime**: What percentage of time was the device online? (historical average)
- **Accuracy**: How often do we correctly identify the status? (system reliability)

All three are different metrics measuring different things.

---

## Getting More Information

### For Team Members

**Technical Details**: See `DEVICE_STATUS_AND_ACCURACY_TRACKING.md`
**API Documentation**: Platform API docs
**Job Implementation**:

- `update-online-status-job.js` (calibrated status)
- `update-raw-online-status-job.js` (raw status)

### Quick Reference

**Status Fields**:

- `isOnline`: Primary status (boolean)
- `rawOnlineStatus`: Raw transmission status (boolean)
- `lastActive`: Last data timestamp (date)
- `statusUpdatedAt`: Last status check (date)

**Accuracy Fields**:

- `totalChecks`: Number of status checks
- `correctChecks`: Times status was correct
- `incorrectChecks`: Times status was wrong
- `accuracyPercentage`: Overall accuracy (%)
- `lastIncorrectReason`: Why last check failed (string)

---

_Document Version: 1.0_  
_Last Updated: November 16, 2025_
