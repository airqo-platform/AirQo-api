# Sliding Session Token Refresh Implementation Guide

## Objective

To implement a seamless and secure token refresh mechanism that prevents users from being logged out unexpectedly. This guide applies to both the Next.js web app and the Flutter mobile app.

## Background

The backend now issues JWTs that expire. To support a smooth transition for existing users, the first token issued upon login will have a 7-day lifespan. For every subsequent authenticated API call, the backend will automatically provide a new, refreshed token (with a standard 24-hour lifespan) in the response headers if the current token is nearing its expiration. Our task on the client is to check for this new token and update our local storage accordingly.

**Key Header:** `X-Access-Token`

## Implementation Steps

This logic should be implemented in your central API/networking layer where all HTTP requests are made and responses are handled.

### 1. On Every Successful API Response (Status 200-299)

After you receive a successful response from any authenticated API endpoint, you must inspect its headers.

**A. Check for the X-Access-Token Header:** The new token will be in a custom header named `X-Access-Token`. Note that HTTP headers are case-insensitive, so your client library might present it as `x-access-token`.

**B. Update Local Storage:** If the `X-Access-Token` header is present and contains a value:

- Immediately replace the old JWT in your local storage (e.g., localStorage on web, Hive or FlutterSecureStorage on mobile) with the new token from the header.
- Log a message for debugging purposes, e.g., "Successfully refreshed and stored new auth token."

### 2. On API Error (Status 401 Unauthorized)

When an API call fails with a 401 Unauthorized status, it means the token is invalid or has definitively expired (and the grace period, if any, has passed).

**A. Trigger Logout:** This is a hard failure. The application must treat this as a logout event.

**B. Clear All Session Data:**

- Delete the expired JWT from local storage.
- Delete any stored user profile information.
- Clear any other session-related state.

**C. Redirect to Login:**

- Forcefully navigate the user to the login screen.
- Display a clear message, such as: "Your session has expired. Please log in again."

## Platform-Specific Code Examples

### For Flutter (in BaseRepository or HTTP client wrapper)

```dart
// In your base_repository.dart or wherever you handle http.Response

Future<http.Response> makeRequest(String url, ...) async {
  // ... existing request logic ...
  final response = await http.get(uri, headers: authHeaders);

  // After getting a successful response:
  if (response.statusCode >= 200 && response.statusCode < 300) {
    final newAuthToken = response.headers['x-access-token']; // Headers are often lowercase
    if (newAuthToken != null && newAuthToken.isNotEmpty) {
      try {
        // Save the new token to Hive or your preferred storage
        await HiveRepository.saveData("token", newAuthToken, HiveBoxNames.authBox);
        loggy.info("Successfully refreshed and stored new auth token.");
      } catch (e) {
        loggy.error("Failed to save refreshed token: $e");
      }
    }
  }
  else if (response.statusCode == 401) {
    // Handle session expiry
    // This should trigger a global logout event in your app's state management (e.g., AuthBloc)
    // For example: context.read<AuthBloc>().add(LogoutEvent());
  }

  return response;
}
```

### For Next.js (in an Axios interceptor or API client utility)

```javascript
// In your api.js or wherever you configure Axios

import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
});

// Add a response interceptor
apiClient.interceptors.response.use(
  (response) => {
    // On successful response, check for the new token
    const newToken = response.headers["x-access-token"];
    if (newToken) {
      console.log("Successfully refreshed and storing new auth token.");
      // Replace the token in localStorage or your state management
      localStorage.setItem("authToken", newToken);
      // If you store the token in memory, update it there as well
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    }
    return response;
  },
  (error) => {
    // On error, check for 401 Unauthorized
    if (error.response && error.response.status === 401) {
      console.error("Session expired. Logging out.");
      // Trigger logout logic
      // For example:
      // 1. Clear local storage
      localStorage.removeItem("authToken");
      localStorage.removeItem("userProfile");
      // 2. Redirect to login page
      window.location.href = "/user/login?session_expired=true";
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

## Conclusion

By following this guide, your applications will provide a secure and seamless user experience, gracefully handling token expirations without any disruption.
