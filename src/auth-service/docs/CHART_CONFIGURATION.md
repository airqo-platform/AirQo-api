# Chart Configuration API Documentation

This documentation describes the API endpoints for managing device chart configurations in the air quality monitoring system. These APIs allow network engineers to customize and persist chart preferences for device data visualization.

## Base URL

```
https://api.airqo.net/api/v2/users/preferences
```

## Authentication

All endpoints require authentication via JWT. Include your token in the Authorization header:

```
Authorization: Bearer your_jwt_token
```

---

## Endpoints

### 1. Create Chart Configuration

Creates a new chart configuration for a specific device.

**URL:** `/:deviceId/charts`  
**Method:** `POST`  
**Auth Required:** Yes

#### Request Parameters

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| deviceId  | String | Yes      | ID of the device |

#### Request Body

```json
{
  "tenant": "airqo",
  "chartConfig": {
    "fieldId": 1,
    "title": "PM2.5 Levels",
    "xAxisLabel": "Time",
    "yAxisLabel": "PM2.5 (μg/m³)",
    "color": "#d62020",
    "backgroundColor": "#ffffff",
    "chartType": "Line",
    "days": 7,
    "results": 100,
    "showLegend": true,
    "showGrid": true,
    "referenceLines": [
      {
        "value": 35,
        "label": "WHO Guideline",
        "color": "#FF0000",
        "style": "dashed"
      }
    ]
  }
}
```

#### Response

**Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Chart configuration created successfully",
  "data": {
    "_id": "6071f3e5c9e77c001234b456",
    "fieldId": 1,
    "title": "PM2.5 Levels",
    "xAxisLabel": "Time",
    "yAxisLabel": "PM2.5 (μg/m³)",
    "color": "#d62020",
    "backgroundColor": "#ffffff",
    "chartType": "Line",
    "days": 7,
    "results": 100,
    "showLegend": true,
    "showGrid": true,
    "referenceLines": [
      {
        "value": 35,
        "label": "WHO Guideline",
        "color": "#FF0000",
        "style": "dashed"
      }
    ]
  }
}
```

**Error Response (400 Bad Request)**

```json
{
  "success": false,
  "message": "Bad Request Error",
  "errors": {
    "message": "Chart configuration must include a field ID"
  }
}
```

---

### 2. Get All Chart Configurations

Retrieves all chart configurations for a specific device.

**URL:** `/:deviceId/charts`  
**Method:** `GET`  
**Auth Required:** Yes

#### Request Parameters

| Parameter | Type   | Required | Description      |
| --------- | ------ | -------- | ---------------- |
| deviceId  | String | Yes      | ID of the device |

#### Query Parameters

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| tenant    | String | No       | Tenant name (default: "airqo") |

#### Response

**Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Chart configurations retrieved successfully",
  "data": [
    {
      "_id": "6071f3e5c9e77c001234b456",
      "fieldId": 1,
      "title": "PM2.5 Levels",
      "xAxisLabel": "Time",
      "yAxisLabel": "PM2.5 (μg/m³)",
      "color": "#d62020",
      "backgroundColor": "#ffffff",
      "chartType": "Line",
      "days": 7,
      "results": 100
    },
    {
      "_id": "6071f3e5c9e77c001234b457",
      "fieldId": 2,
      "title": "Temperature",
      "xAxisLabel": "Time",
      "yAxisLabel": "Temperature (°C)",
      "color": "#2080d6",
      "backgroundColor": "#ffffff",
      "chartType": "Line",
      "days": 7,
      "results": 100
    }
  ]
}
```

**Empty Response (200 OK)**

```json
{
  "success": true,
  "message": "No chart configurations found for this device",
  "data": []
}
```

---

### 3. Get Chart Configuration by ID

Retrieves a specific chart configuration by its ID.

**URL:** `/:deviceId/charts/:chartId`  
**Method:** `GET`  
**Auth Required:** Yes

#### Request Parameters

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| deviceId  | String | Yes      | ID of the device       |
| chartId   | String | Yes      | ID of the chart config |

#### Query Parameters

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| tenant    | String | No       | Tenant name (default: "airqo") |

#### Response

**Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Chart configuration retrieved successfully",
  "data": {
    "_id": "6071f3e5c9e77c001234b456",
    "fieldId": 1,
    "title": "PM2.5 Levels",
    "xAxisLabel": "Time",
    "yAxisLabel": "PM2.5 (μg/m³)",
    "color": "#d62020",
    "backgroundColor": "#ffffff",
    "chartType": "Line",
    "days": 7,
    "results": 100,
    "showLegend": true,
    "showGrid": true,
    "referenceLines": [
      {
        "value": 35,
        "label": "WHO Guideline",
        "color": "#FF0000",
        "style": "dashed"
      }
    ]
  }
}
```

**Error Response (404 Not Found)**

```json
{
  "success": false,
  "message": "Chart configuration not found",
  "errors": {
    "message": "Chart configuration not found"
  }
}
```

---

### 4. Update Chart Configuration

Updates an existing chart configuration.

**URL:** `/:deviceId/charts/:chartId`  
**Method:** `PUT`  
**Auth Required:** Yes

#### Request Parameters

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| deviceId  | String | Yes      | ID of the device       |
| chartId   | String | Yes      | ID of the chart config |

#### Request Body

```json
{
  "tenant": "airqo",
  "title": "Updated PM2.5 Levels",
  "chartType": "Spline",
  "color": "#3366cc",
  "referenceLines": [
    {
      "value": 25,
      "label": "Updated Threshold",
      "color": "#FF9900",
      "style": "solid"
    }
  ]
}
```

#### Response

**Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Chart configuration updated successfully",
  "data": {
    "_id": "6071f3e5c9e77c001234b456",
    "fieldId": 1,
    "title": "Updated PM2.5 Levels",
    "xAxisLabel": "Time",
    "yAxisLabel": "PM2.5 (μg/m³)",
    "color": "#3366cc",
    "backgroundColor": "#ffffff",
    "chartType": "Spline",
    "days": 7,
    "results": 100,
    "showLegend": true,
    "showGrid": true,
    "referenceLines": [
      {
        "value": 25,
        "label": "Updated Threshold",
        "color": "#FF9900",
        "style": "solid"
      }
    ]
  }
}
```

**Error Response (404 Not Found)**

```json
{
  "success": false,
  "message": "Chart configuration not found",
  "errors": {
    "message": "Chart configuration not found"
  }
}
```

---

### 5. Delete Chart Configuration

Deletes an existing chart configuration.

**URL:** `/:deviceId/charts/:chartId`  
**Method:** `DELETE`  
**Auth Required:** Yes

#### Request Parameters

| Parameter | Type   | Required | Description            |
| --------- | ------ | -------- | ---------------------- |
| deviceId  | String | Yes      | ID of the device       |
| chartId   | String | Yes      | ID of the chart config |

#### Request Body

```json
{
  "tenant": "airqo"
}
```

#### Response

**Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Chart configuration deleted successfully"
}
```

**Error Response (404 Not Found)**

```json
{
  "success": false,
  "message": "Chart configuration not found",
  "errors": {
    "message": "Chart configuration not found"
  }
}
```

---

### 6. Copy Chart Configuration

Creates a copy of an existing chart configuration.

**URL:** `/:deviceId/charts/:chartId/copy`  
**Method:** `POST`  
**Auth Required:** Yes

#### Request Parameters

| Parameter | Type   | Required | Description                    |
| --------- | ------ | -------- | ------------------------------ |
| deviceId  | String | Yes      | ID of the device               |
| chartId   | String | Yes      | ID of the chart config to copy |

#### Request Body

```json
{
  "tenant": "airqo"
}
```

#### Response

**Success Response (200 OK)**

```json
{
  "success": true,
  "message": "Chart configuration copied successfully",
  "data": {
    "_id": "6071f3e5c9e77c001234b458",
    "fieldId": 1,
    "title": "PM2.5 Levels (Copy)",
    "xAxisLabel": "Time",
    "yAxisLabel": "PM2.5 (μg/m³)",
    "color": "#d62020",
    "backgroundColor": "#ffffff",
    "chartType": "Line",
    "days": 7,
    "results": 100,
    "showLegend": true,
    "showGrid": true,
    "referenceLines": [
      {
        "value": 35,
        "label": "WHO Guideline",
        "color": "#FF0000",
        "style": "dashed"
      }
    ]
  }
}
```

**Error Response (404 Not Found)**

```json
{
  "success": false,
  "message": "Chart configuration not found",
  "errors": {
    "message": "Chart configuration not found"
  }
}
```

## Chart Configuration Schema

Below is the schema for a chart configuration object:

| Field Name         | Type    | Required | Default     | Description                                   |
| ------------------ | ------- | -------- | ----------- | --------------------------------------------- |
| fieldId            | Number  | Yes      | -           | ThingSpeak field ID (1-8)                     |
| title              | String  | No       | Chart Title | Title of the chart                            |
| xAxisLabel         | String  | No       | Time        | Label for x-axis                              |
| yAxisLabel         | String  | No       | Value       | Label for y-axis                              |
| color              | String  | No       | #d62020     | Main color for chart elements                 |
| backgroundColor    | String  | No       | #ffffff     | Background color of the chart                 |
| chartType          | String  | No       | Line        | Type of chart (Line, Column, Bar, etc.)       |
| days               | Number  | No       | 1           | Number of days of data to show                |
| results            | Number  | No       | 20          | Number of data points to show                 |
| timescale          | Number  | No       | 10          | Time interval between data points             |
| average            | Number  | No       | 10          | Averaging period for data                     |
| median             | Number  | No       | 10          | Median calculation period                     |
| sum                | Number  | No       | 10          | Sum calculation period                        |
| rounding           | Number  | No       | 2           | Decimal places to round to                    |
| dataMin            | Number  | No       | -           | Minimum value in the dataset                  |
| dataMax            | Number  | No       | -           | Maximum value in the dataset                  |
| yAxisMin           | Number  | No       | -           | Minimum value for y-axis                      |
| yAxisMax           | Number  | No       | -           | Maximum value for y-axis                      |
| showLegend         | Boolean | No       | true        | Whether to show the legend                    |
| showGrid           | Boolean | No       | true        | Whether to show grid lines                    |
| showTooltip        | Boolean | No       | true        | Whether to show tooltips on hover             |
| referenceLines     | Array   | No       | []          | Horizontal reference lines                    |
| annotations        | Array   | No       | []          | Point annotations for specific data points    |
| transformation     | Object  | No       | -           | Data transformation settings                  |
| comparisonPeriod   | Object  | No       | -           | Settings for historical data comparison       |
| showMultipleSeries | Boolean | No       | false       | Whether to show multiple data series          |
| additionalSeries   | Array   | No       | []          | Configuration for additional data series      |
| isPublic           | Boolean | No       | false       | Whether the chart is publicly accessible      |
| refreshInterval    | Number  | No       | 0           | Auto-refresh interval in seconds (0=disabled) |

### Reference Line Object

```json
{
  "value": 35,
  "label": "WHO Guideline",
  "color": "#FF0000",
  "style": "dashed"
}
```

### Annotation Object

```json
{
  "x": 1617235200000,
  "y": 42,
  "text": "Pollution peak",
  "color": "#000000"
}
```

### Transformation Object

```json
{
  "type": "log",
  "factor": 1
}
```

### Comparison Period Object

```json
{
  "enabled": true,
  "type": "previousWeek"
}
```

### Additional Series Object

```json
{
  "fieldId": 2,
  "label": "Temperature",
  "color": "#2080d6"
}
```

## Request Format Differences

When working with the chart configuration endpoints, it's important to note the different request formats required:

1. **Create Endpoint** - Chart properties must be nested in a `chartConfig` object:

   ```json
   {
     "tenant": "airqo",
     "chartConfig": {
       "fieldId": 1,
       "title": "PM2.5 Levels",
       ...
     }
   }
   ```

2. **Update Endpoint** - Chart properties should be placed directly in the request body:
   ```json
   {
     "tenant": "airqo",
     "title": "Updated PM2.5 Levels",
     "chartType": "Spline",
     ...
   }
   ```

## Error Handling

The API provides specific error messages to help troubleshoot validation issues:

- If the `chartConfig` object is missing on create:

  ```json
  {
    "success": false,
    "message": "Bad Request Error",
    "errors": {
      "chartConfig": "chartConfig object is required"
    }
  }
  ```

- If required fields are missing:
  ```json
  {
    "success": false,
    "message": "Bad Request Error",
    "errors": {
      "chartConfig.fieldId": "fieldId is required in chartConfig"
    }
  }
  ```

## Reference Line Best Practices

When using reference lines to display thresholds:

- **Air Quality Standards**: Use different colors to indicate different health risk levels

  ```json
  "referenceLines": [
    {
      "value": 12,
      "label": "WHO Annual",
      "color": "#4CAF50",
      "style": "dashed"
    },
    {
      "value": 35,
      "label": "WHO 24-hour",
      "color": "#FFC107",
      "style": "dashed"
    },
    {
      "value": 55,
      "label": "Unhealthy",
      "color": "#F44336",
      "style": "solid"
    }
  ]
  ```

- **Device Thresholds**: Indicate device warning or critical thresholds
  ```json
  "referenceLines": [
    {
      "value": 80,
      "label": "Warning Threshold",
      "color": "#FF9800",
      "style": "dashed"
    },
    {
      "value": 95,
      "label": "Critical Threshold",
      "color": "#FF0000",
      "style": "solid"
    }
  ]
  ```

## Multi-Series Chart Examples

For correlation analysis between different metrics, use the `showMultipleSeries` and `additionalSeries` properties:

```json
{
  "fieldId": 1,
  "title": "PM2.5 vs Temperature",
  "showMultipleSeries": true,
  "additionalSeries": [
    {
      "fieldId": 2,
      "label": "Temperature",
      "color": "#2196F3"
    }
  ]
}
```

Common multi-series combinations for air quality monitoring:

- PM2.5 + Temperature
- PM2.5 + Humidity
- PM2.5 + PM10 (particle size comparison)
- PM2.5 + NO2 (multi-pollutant analysis)

## Best Practices

1. **Creating Charts:** When creating a new chart, always specify at least the required `fieldId` parameter.

2. **Updating Charts:** Only send the properties you want to update, not the entire chart configuration.

3. **Reference Lines:** Use reference lines to highlight important thresholds (e.g., WHO guidelines for air quality).

4. **Multiple Series:** For correlating data (e.g., PM2.5 vs. Temperature), enable `showMultipleSeries` and configure `additionalSeries`.

5. **Chart Types:** Choose the appropriate chart type:

   - `Line` or `Spline`: For continuous time-series data
   - `Column`: For discrete time intervals
   - `Bar`: For comparing categories
   - `Area`: For emphasizing volume
   - `Scatter`: For correlation analysis

6. **Performance:** Limit the number of data points (`results`) to improve loading and rendering performance.

7. **Colors:** Use appropriate colors for different types of data:

   - Air quality: Red-Yellow-Green spectrum
   - Temperature: Blue-Red spectrum
   - Humidity: Blue shades

8. **Mobile Considerations:** Keep chart titles and labels concise for better mobile display.
