# API Documentation for Blog Post Management

**Base URL**: `https://api.yourdomain.com/v2/articles`

## Authentication

Note: Authentication middleware is commented out in the current implementation. Ensure to enable JWT authentication if required.

---

## **1. Edit a Blog Post**

**Endpoint**: `GET /edit/:id`

### Description

Retrieve the details of a specific blog post for editing.

### Parameters

- `id` (path parameter): The ID of the blog post to edit.

### Example Request

```http
GET /articles/edit/123 HTTP/1.1
Host: api.yourdomain.com
```

---

## **2. Update a Blog Post**

**Endpoint**: `PUT /edit/:id`

### Description

Update the details of a specific blog post.

### Parameters

- `id` (path parameter): The ID of the blog post to update.

### Request Body Example

```json
{
  "title": "Updated Blog Post Title",
  "body": "This is the updated content of the blog post.",
  "tags": ["tag1", "tag2"],
  "category": "Updated Category"
}
```

### Example Request

```http
PUT /articles/edit/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Updated Blog Post Title",
  "body": "This is the updated content of the blog post.",
  "tags": ["tag1", "tag2"],
  "category": "Updated Category"
}
```

---

## **3. Delete a Blog Post**

**Endpoint**: `DELETE /delete/:id`

### Description

Delete a specific blog post.

### Parameters

- `id` (path parameter): The ID of the blog post to delete.

### Example Request

```http
DELETE /articles/delete/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **4. Schedule a Blog Post**

**Endpoint**: `POST /schedule/:id`

### Description

Schedule a specific blog post for future publication.

### Parameters

- `id` (path parameter): The ID of the blog post to schedule.

### Request Body Example

```json
{
  "scheduledDate": "2024-01-31T10:00:00Z"
}
```

### Example Request

```http
POST /articles/schedule/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "scheduledDate": "2024-01-31T10:00:00Z"
}
```

---

## **5. Get Blog Post History**

**Endpoint**: `GET /history/:id`

### Description

Retrieve the revision history of a specific blog post.

### Parameters

- `id` (path parameter): The ID of the blog post for which to retrieve history.

### Example Request

```http
GET /articles/history/123 HTTP/1.1
Host: api.yourdomain.com
```
