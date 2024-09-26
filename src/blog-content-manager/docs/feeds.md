# API Documentation for RSS Feed Management

**Base URL**: `https://api.yourdomain.com/v2/blogs`

## Authentication

Note: Authentication middleware is commented out in the current implementation. Ensure to enable JWT authentication if required.

---

## **1. Generate RSS Feed**

**Endpoint**: `GET /:blogId/rss`

### Description

Generate an RSS feed for a specific blog.

### Parameters

- `blogId` (path parameter): The ID of the blog for which to generate the RSS feed.

### Query Parameters

- **Customization Options** (optional): You can include customization options in the query string if applicable. However, since no specific customization parameters are defined in your code, this section can be modified based on your implementation.

### Example Request

```http
GET /blogs/123/rss HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```
