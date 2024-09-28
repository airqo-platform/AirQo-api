# API Documentation for Content Moderation

**Base URL**: `https://api.yourdomain.com/v2/moderation`

## Authentication

Note: Authentication middleware is commented out in the current implementation. Ensure to enable JWT authentication if required.

---

## **1. List User Registrations for Review**

**Endpoint**: `GET /registrations`

### Description

Retrieve a list of user registrations pending approval or rejection.

### Query Parameters

- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /moderation/registrations?limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **2. Approve User Registration**

**Endpoint**: `PUT /registrations/:userId/approve`

### Description

Approve a specific user registration.

### Parameters

- `userId` (path parameter): The ID of the user registration to approve.

### Example Request

```http
PUT /moderation/registrations/456/approve HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **3. Reject User Registration**

**Endpoint**: `PUT /registrations/:userId/reject`

### Description

Reject a specific user registration.

### Parameters

- `userId` (path parameter): The ID of the user registration to reject.

### Example Request

```http
PUT /moderation/registrations/456/reject HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **4. Flag a Post as Inappropriate**

**Endpoint**: `POST /:postId/flag`

### Description

Flag a specific blog post as inappropriate.

### Parameters

- `postId` (path parameter): The ID of the post to flag.

### Example Request

```http
POST /moderation/123/flag HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **5. View Flags on a Post**

**Endpoint**: `GET /:postId/flags`

### Description

Retrieve all flags associated with a specific blog post.

### Parameters

- `postId` (path parameter): The ID of the post for which to view flags.

### Example Request

```http
GET /moderation/123/flags HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **6. Suspend a User**

**Endpoint**: `PUT /:userId/suspend`

### Description

Suspend a specific user, preventing them from accessing their account temporarily.

### Parameters

- `userId` (path parameter): The ID of the user to suspend.

### Example Request

```http
PUT /moderation/456/suspend HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **7. Ban a User**

**Endpoint**: `PUT /:userId/ban`

### Description

Ban a specific user, permanently preventing them from accessing their account.

### Parameters

- `userId` (path parameter): The ID of the user to ban.

### Example Request

```http
PUT /moderation/456/ban HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```
