# API Documentation for Search Management

**Base URL**: `https://api.yourdomain.com/v2/search`

## Authentication

Note: Authentication middleware is commented out in the current implementation. Ensure to enable JWT authentication if required.

---

## **1. Search**

**Endpoint**: `GET /`

### Description

Perform a search based on the provided query parameters.

### Query Parameters

- `q` (required): The search query string.
- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /search?q=blogging&limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **2. Autocomplete Search**

**Endpoint**: `GET /autocomplete`

### Description

Retrieve autocomplete suggestions based on the user's input.

### Query Parameters

- `term` (required): The term for which to get autocomplete suggestions.
- `limit` (optional): Number of results to return (default is 100).

### Example Request

```http
GET /search/autocomplete?term=blog HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **3. Filter Results**

**Endpoint**: `GET /filter`

### Description

Filter search results based on specific criteria.

### Query Parameters

- `q` (required): The search query string.
- Additional filter parameters can be added as needed (e.g., category, date range).
- `limit` (optional): Number of results to return (default is 100).
- `skip` (optional): Number of results to skip (default is 0).

### Example Request

```http
GET /search/filter?q=blogging&category=technology&limit=10&skip=0 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## **4. Paginate Results**

**Endpoint**: `GET /paginate`

### Description

Retrieve paginated search results based on the provided query parameters.

### Query Parameters

- `q` (required): The search query string.
- `page` (optional): The page number to retrieve.
- `limit` (optional): Number of results per page (default is 100).

### Example Request

```http
GET /search/paginate?q=blogging&page=2&limit=10 HTTP/1.1
Host: api.yourdomain.com
Authorization: Bearer YOUR_JWT_TOKEN
```
