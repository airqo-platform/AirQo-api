# API Documentation for Blog Post Management

**Base URL**: `https://api.yourdomain.com/v2/posts`

## Authentication

Note: Authentication middleware is commented out in the current implementation. Ensure to enable JWT authentication if required.

---

## **1. List All Blog Posts**

**Endpoint**: `GET /`

### Description

Retrieve a list of all blog posts.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /posts?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **2. Create a New Blog Post**

**Endpoint**: `POST /`

### Description

Create a new blog post.

### Request Body Example

```json
{
  "title": "My New Blog Post",
  "body": "This is the content of my new blog post.",
  "tags": ["tag1", "tag2"],
  "category": "Category Name"
}
```

### Example Request

```http
POST /posts HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "My New Blog Post",
  "body": "This is the content of my new blog post.",
  "tags": ["tag1", "tag2"],
  "category": "Category Name"
}
```

---

## **3. Update Draft Status of a Blog Post**

**Endpoint**: `PATCH /:id/draft`

### Description

Update the draft status of a specific blog post.

### Parameters

- `id` (path parameter): The ID of the blog post to update.

### Request Body Example

```json
{
  "isDraft": true // or false to publish
}
```

### Example Request

```http
PATCH /posts/123/draft HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "isDraft": true
}
```

---

## **4. Retrieve a Specific Blog Post**

**Endpoint**: `GET /:id`

### Description

Retrieve the details of a specific blog post.

### Parameters

- `id` (path parameter): The ID of the blog post to retrieve.

### Example Request

```http
GET /posts/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **5. Update a Blog Post**

**Endpoint**: `PUT /:id`

### Description

Update an existing blog post.

### Parameters

- `id` (path parameter): The ID of the blog post to update.

### Request Body Example

```json
{
  "title": "Updated Blog Post Title",
  "body": "This is the updated content.",
  "tags": ["updatedTag"],
  "category": "Updated Category"
}
```

### Example Request

```http
PUT /posts/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "title": "Updated Blog Post Title",
  "body": "This is the updated content.",
  "tags": ["updatedTag"],
  "category": "Updated Category"
}
```

---

## **6. Delete a Blog Post**

**Endpoint**: `DELETE /:id`

### Description

Delete a specific blog post.

### Parameters

- `id` (path parameter): The ID of the blog post to delete.

### Example Request

```http
DELETE /posts/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **7. Upload an Image for a Blog Post**

**Endpoint**: `POST /:id/images`

### Description

Upload an image associated with a specific blog post.

### Parameters

- `id` (path parameter): The ID of the blog post for which to upload an image.

### Example Request

```http
POST /posts/123/images HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: multipart/form-data

// Include image file in form data here.
```

---

## **8. Preview a Blog Post**

**Endpoint**: `GET /:id/preview`

### Description

Preview a specific blog post before publishing.

### Parameters

- `id` (path parameter): The ID of the blog post to preview.

### Example Request

```http
GET /posts/123/preview HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```
