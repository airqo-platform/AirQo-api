# Performance Jobs

This directory contains cronjobs for fetching and processing performance data.

## fetch_thingspeak_data.py

Fetches device data from ThingSpeak and updates both `fact_device_performance` and `fact_airqloud_performance` tables.

### Features

- **Automated Pagination**: Automatically handles datasets larger than 8,000 records by fetching data in batches
- **Performance Metrics**: Calculates frequency and error margin for devices and airqlouds
- **Flexible Date Ranges**: Supports custom date ranges or defaults to the last 24 hours
- **Selective Processing**: Can process specific devices or airqlouds
- **Error Handling**: Comprehensive error handling and logging
- **Statistics**: Provides detailed execution statistics

### Usage

#### Basic Usage (Last 24 hours)
```bash
python cronjobs/performance_jobs/fetch_thingspeak_data.py
```

#### Specify Number of Days
```bash
python cronjobs/performance_jobs/fetch_thingspeak_data.py --days 7
```

#### Specify Date Range
```bash
python cronjobs/performance_jobs/fetch_thingspeak_data.py --start-date 2024-01-01 --end-date 2024-01-31
```

#### Process Specific Devices
```bash
python cronjobs/performance_jobs/fetch_thingspeak_data.py --device-ids device1 device2 device3
```

#### Process Specific AirQlouds
```bash
python cronjobs/performance_jobs/fetch_thingspeak_data.py --airqloud-ids airqloud1 airqloud2
```

#### Combined Options
```bash
python cronjobs/performance_jobs/fetch_thingspeak_data.py --days 30 --device-ids device1 device2
```

### How It Works

1. **Device Processing** (Hourly Aggregation):
   - Fetches all active devices with ThingSpeak credentials (channel_id and read_key)
   - For each device, queries ThingSpeak API for data within the specified date range
   - If data exceeds 8,000 records, automatically paginates by updating the end date to the earliest record's timestamp
   - Groups data by hour and calculates hourly performance metrics:
     - `freq`: Number of data points in each hour
     - `error_margin`: Average absolute difference between field1 and field3 for that hour
     - `timestamp`: The specific hour (e.g., 2024-11-07 14:00:00)
   - Creates one performance record per hour
   - Stores results in `fact_device_performance` table

2. **AirQloud Processing** (Daily Aggregation):
   - Retrieves all active airqlouds
   - For each airqloud, gets all associated devices
   - Groups device performance data by day
   - Calculates daily aggregated metrics:
     - `error_margin`: Daily average of error margins from all devices in the airqloud
     - `freq`: Average uptime (unique hourly entries per day) across all devices
       - Represents how many unique hours each device reported data (max is 24)
       - Example: If 3 devices report [20, 22, 24] hours → freq = 22
     - `timestamp`: The specific day (e.g., 2024-11-07 00:00:00)
   - Creates one performance record per day
   - Stores results in `fact_airqloud_performance` table

### ThingSpeak API Integration

The job uses the following ThingSpeak endpoint:
```
https://api.thingspeak.com/channels/{channel_id}/feeds.json?start={start}&end={end}&api_key={api_key}&results=8000
```

**Pagination Logic**:
- Initial request: fetches up to 8,000 records
- If 8,000 records are returned, fetches the next batch using the earliest timestamp as the new end date
- Continues until all data is retrieved or start date is reached

### Environment Variables

Ensure the following are set in your `.env` file:
- `THINGSPEAK_API_BASE_URL`: ThingSpeak base URL (default: https://api.thingspeak.com)
- Database connection variables (POSTGRES_*)

### Database Requirements

**Devices must have**:
- `channel_id`: ThingSpeak channel ID
- `read_key`: ThingSpeak read API key
- `is_active`: Set to true

**Tables Updated**:
- `fact_device_performance`: Stores device-level performance metrics
- `fact_airqloud_performance`: Stores airqloud-level aggregated metrics

### Performance Metrics Explained

#### Device Performance (Hourly)

**Frequency (freq)**
- Number of data points received in each hour
- Range: 0 to unlimited (typically 60-3600 depending on device reporting frequency)
- Higher values indicate more frequent data reporting

**Error Margin (error_margin)**
- Average absolute difference between field1 and field3 for that hour
- Calculated as: `average(|field1 - field3|)` for all data points in the hour
- Lower values indicate better sensor accuracy/consistency
- Example: If hour has 3 readings: |2.5-2.3|, |2.6-2.4|, |2.7-2.5| → avg = 0.2

**Timestamp**
- Truncated to the hour (e.g., 2024-11-07 14:00:00)
- Represents the specific hour this performance data covers

#### AirQloud Performance (Daily)

**Frequency (freq)**
- Average uptime across all devices in the airqloud
- Calculated as the average number of unique hourly entries per day for each device
- Range: 0 to 24 (representing hours per day)
- Example calculation:
  - Device A: 20 unique hours
  - Device B: 22 unique hours  
  - Device C: 24 unique hours
  - AirQloud freq = (20 + 22 + 24) / 3 = 22
- Higher values indicate better device uptime

**Error Margin (error_margin)**
- Daily average of all error margins from all devices in the airqloud
- Aggregates all hourly error margins from all devices for that day
- Lower values indicate better overall airqloud data quality

**Timestamp**
- Truncated to the day (e.g., 2024-11-07 00:00:00)
- Represents the specific day this performance data covers

### Scheduling with Cron

To run daily at midnight:
```cron
0 0 * * * cd /path/to/beacon-api && python cronjobs/performance_jobs/fetch_thingspeak_data.py --days 1
```

To run every 6 hours:
```cron
0 */6 * * * cd /path/to/beacon-api && python cronjobs/performance_jobs/fetch_thingspeak_data.py --days 1
```

### Monitoring and Logs

The job provides detailed logging:
- INFO level: Progress updates and summaries
- WARNING level: Missing data or configuration issues
- ERROR level: Failed operations

**Sample Log Output**:
```
2024-11-07 10:00:00 - __main__ - INFO - Starting ThingSpeak data fetch job
2024-11-07 10:00:00 - __main__ - INFO - Date range: 2024-11-06 10:00:00 to 2024-11-07 10:00:00
2024-11-07 10:00:00 - __main__ - INFO - Found 50 devices to process
2024-11-07 10:00:05 - __main__ - INFO - Fetched 8000 records for channel 12345
2024-11-07 10:00:05 - __main__ - INFO - Continuing pagination, next batch ends at 2024-11-06 15:30:00
2024-11-07 10:00:10 - __main__ - INFO - Total records fetched for channel 12345: 12500
2024-11-07 10:00:10 - __main__ - INFO - Created performance record for device device1: freq=12500, error_margin=2.5
...
2024-11-07 10:05:00 - __main__ - INFO - ================================================================================
2024-11-07 10:05:00 - __main__ - INFO - ThingSpeak Data Fetch Job Summary
2024-11-07 10:05:00 - __main__ - INFO - ================================================================================
2024-11-07 10:05:00 - __main__ - INFO - Devices processed: 50
2024-11-07 10:05:00 - __main__ - INFO - Device records fetched: 625000
2024-11-07 10:05:00 - __main__ - INFO - Device performance records created: 50
2024-11-07 10:05:00 - __main__ - INFO - AirQlouds processed: 10
2024-11-07 10:05:00 - __main__ - INFO - AirQloud performance records created: 10
2024-11-07 10:05:00 - __main__ - INFO - API requests made: 75
2024-11-07 10:05:00 - __main__ - INFO - Errors encountered: 0
2024-11-07 10:05:00 - __main__ - INFO - ================================================================================
```

### Troubleshooting

**Issue**: No data fetched for devices
- Verify devices have `channel_id` and `read_key` set
- Check if devices are marked as `is_active=true`
- Verify ThingSpeak API credentials are valid

**Issue**: Pagination not working
- Check ThingSpeak API rate limits
- Verify date format in requests
- Ensure `created_at` field exists in ThingSpeak responses

**Issue**: Performance records not created
- Check database connectivity
- Verify foreign key constraints (device_id must exist in dim_device)
- Review error logs for specific issues

### Customization

You can customize the performance calculation by modifying the `calculate_device_performance` method:

```python
def calculate_device_performance(self, feeds, device_id):
    # Your custom calculation logic here
    freq = len(feeds)
    error_margin = calculate_custom_error(feeds)
    return DevicePerformanceCreate(...)
```

### Testing

Test with a single device:
```bash
python cronjobs/performance_jobs/fetch_thingspeak_data.py --device-ids test_device --days 1
```

Test with a specific date range:
```bash
python cronjobs/performance_jobs/fetch_thingspeak_data.py --start-date 2024-11-01 --end-date 2024-11-02 --device-ids test_device
```
