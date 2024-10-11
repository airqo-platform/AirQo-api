# API Documentation for Comment Management

**Base URL**: `https://api.yourdomain.com/v2/posts`

## Authentication

Note: Authentication middleware is commented out in the current implementation. Ensure to enable JWT authentication if required.

---

## **1. Create a Comment**

**Endpoint**: `POST /:postId/comments`

### Description

Add a new comment to a specific blog post.

### Parameters

- `postId` (path parameter): The ID of the post to which the comment will be added.

### Request Body Example

```json
{
  "content": "This is a comment."
}
```

### Example Request

```http
POST /posts/123/comments HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "content": "This is a comment."
}
```

---

## **2. List Comments for a Post**

**Endpoint**: `GET /:postId/comments`

### Description

Retrieve all comments associated with a specific blog post.

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

## **3. Get Replies to a Comment**

**Endpoint**: `GET /:postId/comments/:commentId/replies`

### Description

Retrieve all replies to a specific comment on a blog post.

### Parameters

- `postId` (path parameter): The ID of the post containing the comment.
- `commentId` (path parameter): The ID of the comment for which to retrieve replies.

### Example Request

```http
GET /posts/123/comments/456/replies HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **4. Edit a Comment**

**Endpoint**: `PUT /:postId/comments/:commentId/edit`

### Description

Update an existing comment on a blog post.

### Parameters

- `postId` (path parameter): The ID of the post containing the comment.
- `commentId` (path parameter): The ID of the comment to update.

### Request Body Example

```json
{
  "content": "This is an updated comment."
}
```

### Example Request

```http
PUT /posts/123/comments/456/edit HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
Content-Type: application/json

{
  "content": "This is an updated comment."
}
```

---

## **5. Delete a Comment**

**Endpoint**: `DELETE /:postId/comments/:commentId/delete`

### Description

Delete a specific comment from a blog post.

### Parameters

- `postId` (path parameter): The ID of the post containing the comment.
- `commentId` (path parameter): The ID of the comment to delete.

### Example Request

```http
DELETE /posts/123/comments/456/delete HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **6. Approve a Comment**

**Endpoint**: `PATCH /:postId/comments/:commentId/approve`

### Description

Approve a specific comment, making it visible on the blog post.

### Parameters

- `postId` (path parameter): The ID of the post containing the comment.
- `commentId` (path parameter): The ID of the comment to approve.

### Example Request

```http
PATCH /posts/123/comments/456/approve HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **7. Reject a Comment**

**Endpoint**: `PATCH /:postId/comments/:commentId/reject`

### Description

Reject a specific comment, preventing it from being visible on the blog post.

### Parameters

- `postId` (path parameter): The ID of the post containing the comment.
- `commentId` (path parameter): The ID of the comment to reject.

### Example Request

```http
PATCH /posts/123/comments/456/reject HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```
