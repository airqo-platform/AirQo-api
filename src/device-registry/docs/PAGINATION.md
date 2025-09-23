# Device Registry API Pagination Guide

This guide explains how to work with paginated responses from the Device Registry API's listing endpoints (e.g., `/api/v2/devices`, `/api/v2/devices/sites`, `/api/v2/devices/cohorts`).

## 1. Overview

All `GET` endpoints that return a list of items now support standardized `skip` and `limit` pagination. The response for these endpoints includes a `meta` object that provides all the necessary information to navigate through the entire dataset.

## 2. Request Parameters

You can control pagination using the following query parameters:

- `limit` (optional): Specifies the maximum number of items to return in a single response.
  - **Default**: `100`
  - **Maximum**: `300`
- `skip` (optional): Specifies the number of items to skip from the beginning of the result set.
  - **Default**: `0`

**Example Request:**

To get the second page of devices, with 25 devices per page:

```
GET /api/v2/devices?limit=25&skip=25
```

## 3. Response Structure

A successful paginated request will return a JSON object with a `meta` field alongside the data (e.g., `devices`, `sites`).

**Example Response Body:**

```json
{
  "success": true,
  "message": "successfully retrieved the device details",
  "devices": [
    // ... array of device objects ...
  ],
  "meta": {
    "total": 5250,
    "totalResults": 25,
    "limit": 25,
    "skip": 25,
    "page": 2,
    "totalPages": 210,
    "nextPage": "https://api.airqo.net/api/v2/devices?limit=25&skip=50",
    "previousPage": "https://api.airqo.net/api/v2/devices?limit=25&skip=0"
  }
}
```

### The `meta` Object Explained:

- `total`: The total number of items that match your query filter across all pages.
- `totalResults`: The number of items in the current response (will be less than or equal to `limit`).
- `limit`: The limit that was used for this request.
- `skip`: The skip value that was used for this request.
- `page`: The current page number, calculated as `(skip / limit) + 1`.
- `totalPages`: The total number of pages available, calculated as `ceil(total / limit)`.
- `nextPage`: A full URL to the next page of results. This field will be absent if you are on the last page.
- `previousPage`: A full URL to the previous page of results. This field will be absent if you are on the first page.

## 4. How to Fetch All Data

To retrieve all items for a given query, you can loop through the pages until the `nextPage` field is no longer present in the `meta` object.

### JavaScript (Node.js) Example

This example uses `axios` to fetch all devices matching a filter.

```javascript
const axios = require("axios");

async function fetchAllDevices(baseUrl, initialParams, authToken) {
  let allDevices = [];
  let nextPageUrl = `${baseUrl}?${new URLSearchParams(initialParams)}`;

  console.log("Starting to fetch all devices...");

  while (nextPageUrl) {
    try {
      console.log(`Fetching from: ${nextPageUrl}`);
      const response = await axios.get(nextPageUrl, {
        headers: {
          Authorization: `JWT ${authToken}`,
        },
      });

      // The actual data is in a key like "devices", "sites", etc.
      const dataKey = Object.keys(response.data).find((k) =>
        Array.isArray(response.data[k])
      );
      const data = dataKey ? response.data[dataKey] : [];
      const { meta } = response.data;

      if (data && Array.isArray(data)) {
        allDevices = allDevices.concat(data);
        console.log(
          `  - Fetched ${data.length} devices. Total so far: ${allDevices.length}`
        );
      }

      // Check if there's a next page
      if (meta && meta.nextPage) {
        nextPageUrl = meta.nextPage;
      } else {
        nextPageUrl = null; // End of results
      }
    } catch (error) {
      console.error(`Error fetching data: ${error.message}`);
      break;
    }
  }

  console.log(
    `\nFinished fetching. Total devices retrieved: ${allDevices.length}`
  );
  return allDevices;
}

// --- Usage ---
const API_BASE_URL = "https://api.airqo.net/api/v2/devices";
const AUTH_TOKEN = "YOUR_JWT_TOKEN_HERE";

const queryParams = {
  limit: 100, // Fetch in batches of 100
};

fetchAllDevices(API_BASE_URL, queryParams, AUTH_TOKEN);
```

### Python Example

This example uses the `requests` library.

```python
import requests
import json

def fetch_all_paginated_data(base_url, initial_params, auth_token, data_key):
    all_items = []
    headers = {'Authorization': f'JWT {auth_token}'}

    params = initial_params
    url = base_url

    print(f'Starting to fetch all {data_key}...')

    while True:
        try:
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()

            json_response = response.json()

            items = json_response.get(data_key, [])
            meta = json_response.get('meta', {})

            if items:
                all_items.extend(items)
                print(f"  - Fetched {len(items)} items. Total so far: {len(all_items)}")

            if 'nextPage' in meta and meta['nextPage']:
                url = meta['nextPage']
                params = {}
            else:
                break

        except requests.exceptions.RequestException as e:
            print(f"An error occurred: {e}")
            break

    print(f"\nFinished fetching. Total items retrieved: {len(all_items)}")
    return all_items

# --- Usage ---
API_BASE_URL = 'https://api.airqo.net/api/v2/devices'
AUTH_TOKEN = 'YOUR_JWT_TOKEN_HERE'

query_params = {
    'limit': 100,
}

all_devices_data = fetch_all_paginated_data(API_BASE_URL, query_params, AUTH_TOKEN, 'devices')
```
