# Device Lookup API Endpoints

The Device Lookup API provides utility endpoints for retrieving specific device identifiers and suggesting device names.

**Base URL**: `/api/v2/lookups`

---

## Get Device ID from Name

Retrieves the unique MongoDB ObjectId of a device given its `name`. This is useful when you have the human-readable device name and need its internal ID for other API calls.

**Endpoint:** `GET /devices/id/{name}`

### Path Parameters

| Parameter | Type   | Required | Description                    |
| :-------- | :----- | :------- | :----------------------------- |
| `name`    | string | Yes      | The unique name of the device. |

### Query Parameters

| Parameter | Type   | Required | Default | Description                                      |
| :-------- | :----- | :------- | :------ | :----------------------------------------------- |
| `tenant`  | string | No       | `airqo` | The tenant identifier. Can be `airqo` or `kcca`. |

### Responses

<details>
<summary><b><code>200 OK</code> - Success</b></summary>

**Body:**

```json
{
  "success": true,
  "message": "Successfully retrieved device ID",
  "data": {
    "_id": "60f1b3f3e4b0a4001f8e8c8c"
  }
}
```

</details>

<details>
<summary><b><code>400 Bad Request</code> - Invalid Input</b></summary>

**Body:**

```json
{
  "success": false,
  "message": "bad request errors",
  "errors": [
    {
      "value": "INVALID_NAME",
      "msg": "Device name must not be empty",
      "param": "name",
      "location": "params"
    }
  ]
}
```

</details>

<details>
<summary><b><code>404 Not Found</code> - Device Not Found</b></summary>

**Body:**

```json
{
  "success": false,
  "message": "Device not found",
  "errors": {
    "message": "Device with name 'non_existent_device' not found"
  }
}
```

</details>

---

## Get Device Name from ID

Retrieves the unique `name` of a device given its MongoDB ObjectId. This is the reverse of the previous endpoint.

**Endpoint:** `GET /devices/name/{id}`

### Path Parameters

| Parameter | Type   | Required | Description                         |
| :-------- | :----- | :------- | :---------------------------------- |
| `id`      | string | Yes      | The MongoDB ObjectId of the device. |

### Query Parameters

| Parameter | Type   | Required | Default | Description                                      |
| :-------- | :----- | :------- | :------ | :----------------------------------------------- |
| `tenant`  | string | No       | `airqo` | The tenant identifier. Can be `airqo` or `kcca`. |

### Responses

<details>
<summary><b><code>200 OK</code> - Success</b></summary>

**Body:**

```json
{
  "success": true,
  "message": "Successfully retrieved device name",
  "data": {
    "name": "aq_g5_1"
  }
}
```

</details>

<details>
<summary><b><code>404 Not Found</code> - Device Not Found</b></summary>

**Body:**

```json
{
  "success": false,
  "message": "Device not found",
  "errors": {
    "message": "Device with ID '60f1b3f3e4b0a4001f8e8c8c' not found"
  }
}
```

</details>

---

## Suggest Device Names

Provides a list of suggested device names based on similarity to the provided name query. This is useful for implementing autocomplete features in user interfaces. The suggestions are ranked by a similarity score.

**Endpoint:** `GET /devices/suggest`

### Query Parameters

| Parameter | Type   | Required | Default | Description                                      |
| :-------- | :----- | :------- | :------ | :----------------------------------------------- |
| `name`    | string | Yes      | -       | The partial or full device name to search for.   |
| `tenant`  | string | No       | `airqo` | The tenant identifier. Can be `airqo` or `kcca`. |

### Responses

<details>
<summary><b><code>200 OK</code> - Success with Suggestions</b></summary>

**Body:**

```json
{
  "success": true,
  "message": "Successfully retrieved device name suggestions.",
  "data": [
    {
      "target": "aq_g5_10",
      "rating": 0.8571428571428571
    },
    {
      "target": "aq_g5_1",
      "rating": 0.75
    }
  ]
}
```

- `target`: The suggested device name.
- `rating`: A similarity score between 0 and 1, where 1 is a perfect match.

</details>

<details>
<summary><b><code>200 OK</code> - No Suggestions Found</b></summary>

**Body:**

```json
{
  "success": true,
  "message": "No similar device names found.",
  "data": []
}
```

</details>
