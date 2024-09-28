# API Documentation for User Interaction Management

**Base URL**: `https://api.yourdomain.com/v2/interactions`

## Authentication

Note: Authentication middleware is commented out in the current implementation. Ensure to enable JWT authentication if required.

---

## **1. Follow a User**

**Endpoint**: `POST /follow/:userId`

### Description

Follow a specific user.

### Parameters

- `userId` (path parameter): The ID of the user to follow.

### Example Request

```http
POST /interactions/follow/456 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **2. Get Notifications**

**Endpoint**: `GET /notifications`

### Description

Retrieve notifications for the authenticated user.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /interactions/notifications?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **3. Like a Post**

**Endpoint**: `POST /:postId/like`

### Description

Like a specific blog post.

### Parameters

- `postId` (path parameter): The ID of the post to like.

### Example Request

```http
POST /interactions/123/like HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **4. Bookmark a Post**

**Endpoint**: `POST /:postId/bookmark`

### Description

Bookmark a specific blog post for later reference.

### Parameters

- `postId` (path parameter): The ID of the post to bookmark.

### Example Request

```http
POST /interactions/123/bookmark HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```
