# API Documentation for Analytics/Reporting Use Case

**Base URL**: `{{baseDOMAIN}}/api/v2/blogs/`

## Authentication

All endpoints require JWT authentication. Ensure you include the `Authorization` header with your Bearer token in requests.

---

## **1. Get Post Views**

**Endpoint**: `GET /posts/:postId/views`

### Description

Retrieve the number of views for a specific blog post.

### Parameters

- `postId` (path parameter): The ID of the post for which to retrieve view statistics.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /posts/123/views?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **2. Get Post Comments**

**Endpoint**: `GET /posts/:postId/comments`

### Description

Retrieve comments for a specific blog post.

### Parameters

- `postId` (path parameter): The ID of the post for which to retrieve comments.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /posts/123/comments?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **3. Get Popular Posts**

**Endpoint**: `GET /posts/popular`

### Description

Retrieve a list of popular blog posts based on views or engagement metrics.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /posts/popular?limit=5&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **4. Get User Views**

**Endpoint**: `GET /users/:userId/views`

### Description

Retrieve the number of views for a specific user’s posts.

### Parameters

- `userId` (path parameter): The ID of the user for whom to retrieve view statistics.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /users/456/views?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **5. Get User Comments**

**Endpoint**: `GET /users/:userId/comments`

### Description

Retrieve comments made by a specific user.

### Parameters

- `userId` (path parameter): The ID of the user for whom to retrieve comments.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /users/456/comments?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **6. Get User Activity**

**Endpoint**: `GET /users/:userId/activity`

### Description

Retrieve activity statistics for a specific user, including posts and interactions.

### Parameters

- `userId` (path parameter): The ID of the user for whom to retrieve activity statistics.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /users/456/activity?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **7. Generate User Growth Report**

**Endpoint**: `POST /reports/user-growth`

### Description

Generate a report on user growth over a specified period.

### Request Body Example

```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

### Example Request

```http
POST /reports/user-growth HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

---

## **8. Generate Post Performance Report**

**Endpoint**: `POST /reports/post-performance`

### Description

Generate a report on post performance metrics over a specified period.

### Request Body Example

```json
{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

### Example Request

```http
POST /reports/post-performance HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "startDate": "2024-01-01",
  "endDate": "2024-01-31"
}
```

.
