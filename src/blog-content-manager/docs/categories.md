# API Documentation for Category and Tag Management

**Base URL**: `https://api.yourdomain.com/v2/categories-tags`

## Authentication

Note: Authentication middleware is commented out in the current implementation. Ensure to enable JWT authentication if required.

---

## **1. Create a Category or Tag**

**Endpoint**: `POST /`

### Description

Create a new category or tag.

### Request Body Example

```json
{
  "name": "New Category",
  "type": "category" // or "tag"
}
```

### Example Request

```http
POST /categories-tags HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "New Category",
  "type": "category"
}
```

---

## **2. List All Categories and Tags**

**Endpoint**: `GET /`

### Description

Retrieve a list of all categories and tags.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /categories-tags?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **3. Update a Category or Tag**

**Endpoint**: `PUT /:id`

### Description

Update an existing category or tag.

### Parameters

- `id` (path parameter): The ID of the category or tag to update.

### Request Body Example

```json
{
  "name": "Updated Category Name"
}
```

### Example Request

```http
PUT /categories-tags/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "name": "Updated Category Name"
}
```

---

## **4. Delete a Category or Tag**

**Endpoint**: `DELETE /:id`

### Description

Delete a specific category or tag.

### Parameters

- `id` (path parameter): The ID of the category or tag to delete.

### Example Request

```http
DELETE /categories-tags/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **5. Assign a Category or Tag to a Blog Post**

**Endpoint**: `POST /assign/:postId`

### Description

Assign a category or tag to a specific blog post.

### Parameters

- `postId` (path parameter): The ID of the blog post to which the category/tag will be assigned.

### Request Body Example

```json
{
  "categoryId": "456" // or "tagId": "789"
}
```

### Example Request

```http
POST /categories-tags/assign/123 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "categoryId": "456"
}
```

---

## **6. Get Posts Associated with a Category or Tag**

**Endpoint**: `GET /posts/:id`

### Description

Retrieve all blog posts associated with a specific category or tag.

### Parameters

- `id` (path parameter): The ID of the category or tag for which to retrieve associated posts.

### Example Request

```http
GET /categories-tags/posts/456 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **7. Browse Categories**

**Endpoint**: `GET /browse/categories`

### Description

Retrieve a list of all available categories.

### Example Request

```http
GET /categories-tags/browse/categories HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **8. Browse Tags**

**Endpoint**: `GET /browse/tags`

### Description

Retrieve a list of all available tags.

### Example Request

```http
GET /categories-tags/browse/tags HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```
