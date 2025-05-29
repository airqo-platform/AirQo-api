# Private Cohort Access Control: Implementation Plan

## Project Overview

**Objective**: Implement access control for private cohorts to allow cohort owners to view air quality measurements from their private cohorts while maintaining microservice separation.

**Architecture Context**:

- Auth Service and Device Registry Service are separate microservices with different databases
- User/Group/Role data is in the Auth Service database
- Device/Cohort/Event data is in Device Registry Service database
- No direct database access between services

**Current Limitation**: Currently, all measurements from private cohorts are filtered out from API responses:

```javascript
.match({
  "cohort_details.visibility": { $ne: false },
})
```

## Selected Approach

We will implement the **Enhanced JWT Tokens with Cohort Access Claims** approach to:

- Eliminate direct API calls between services
- Maintain proper access control for private cohorts
- Provide a seamless user experience
- Ensure system resilience

## Implementation Plan

### Phase 1: Auth Service Enhancements

#### 1. Identify Group-Cohort Relationship Format

- [ ] Examine cohort data structure in MongoDB
- [ ] Confirm how groups are referenced in the `cohort.groups` field
- [ ] Document the exact format of group identifiers in cohorts
- [ ] Determine the appropriate string format for consistent matching

#### 2. Add Cohort Access Method to User Schema

```javascript
// Add to UserSchema.methods in auth service
UserSchema.methods.getCohortAccessClaims = async function() {
  try {
    // Get user's group roles with populated role information
    const user = await UserModel("airqo")
      .findById(this._id)
      .populate({
        path: "group_roles.role",
        select: "role_name role_permissions",
      })
      .populate({
        path: "group_roles.group",
        select: "grp_title _id",
      })
      .lean();

    if (!user) return { managedGroups: [], canAccessPrivateCohorts: false };

    // Filter groups where user has admin/owner role
    const managedGroups = user.group_roles
      .filter((gr) => {
        // User is admin if they have specific role or permission
        return (
          gr.userType === "user" || (gr.role && gr.role.role_name === "admin")
        );
      })
      .map((gr) => {
        // Store normalized group title (matches format used in Cohort model)
        return gr.group.grp_title.toLowerCase();
      });

    return {
      managedGroups,
      canAccessPrivateCohorts: managedGroups.length > 0,
      permissionsUpdatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error(`Error getting cohort access: ${error.message}`);
    return { managedGroups: [], canAccessPrivateCohorts: false };
  }
};
```

- [ ] Implement `getCohortAccessClaims()` method on User Schema
- [ ] Ensure consistent string format for group identifiers
- [ ] Add unit tests for the new method
- [ ] Verify it correctly identifies groups a user can access

#### 3. Enhance JWT Token Generation

```javascript
// Replace existing UserSchema.methods.createToken
UserSchema.methods.createToken = async function() {
  try {
    // Get the basic user information
    const userWithDerivedAttributes = await UserModel("airqo").list({
      filter: { _id: this._id },
    });

    if (!userWithDerivedAttributes.success) {
      return userWithDerivedAttributes;
    }

    const user = userWithDerivedAttributes.data[0];

    // Get cohort access claims
    const cohortAccess = await this.getCohortAccessClaims();

    // Create token with cohort access information
    return jwt.sign(
      {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        // ... other standard claims

        // Add cohort access information
        cohortAccess,
      },
      constants.JWT_SECRET,
      { expiresIn: "2h" } // Set an expiration time
    );
  } catch (error) {
    logger.error(`Token generation error: ${error.message}`);
    throw error;
  }
};
```

- [ ] Modify `createToken()` method to include cohort access claims
- [ ] Set appropriate token expiration time (2 hours recommended)
- [ ] Add error handling and logging
- [ ] Create tests to verify token format and contents

### Phase 2: Device Registry Service Enhancements

#### 1. Create JWT Extraction Middleware

```javascript
// middleware/extractCohortAccess.js
const jwt = require("jsonwebtoken");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- extract-cohort-access`
);

module.exports = (req, res, next) => {
  // Default access if no token provided
  req.cohortAccess = { managedGroups: [], canAccessPrivateCohorts: false };

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, constants.JWT_SECRET);

    if (decoded && decoded.cohortAccess) {
      req.cohortAccess = decoded.cohortAccess;
      req.userId = decoded._id;

      // Normalize group identifiers for consistent matching
      if (Array.isArray(req.cohortAccess.managedGroups)) {
        req.cohortAccess.managedGroups = req.cohortAccess.managedGroups.map(
          (g) => (typeof g === "string" ? g.toLowerCase() : g)
        );
      }
    }

    next();
  } catch (error) {
    logger.error(`JWT verification error: ${error.message}`);
    // Continue with default no-access
    next();
  }
};
```

- [ ] Create middleware to extract cohort access from JWT
- [ ] Add error handling and logging
- [ ] Ensure string normalization for consistent matching
- [ ] Write tests for various token scenarios

#### 2. Apply Middleware to Routes

```javascript
// routes/events.routes.js
const express = require("express");
const router = express.Router();
const eventsController = require("../controllers/events.controller");
const extractCohortAccess = require("../middleware/extractCohortAccess");

// Apply middleware to all event routes
router.use(extractCohortAccess);

// Define routes
router.get("/", eventsController.getEvents);
router.get("/recent", eventsController.getRecentEvents);
router.get("/historical", eventsController.getHistoricalEvents);

module.exports = router;
```

- [ ] Add middleware to all event-related routes
- [ ] Verify middleware is executed before controllers

#### 3. Modify Events Aggregation Pipeline

```javascript
// In the fetchData function in Event.js
async function fetchData(model, filter, cohortAccess = null) {
  // ... existing code ...

  // Determine cohort visibility match condition based on user access
  let cohortVisibilityMatch;

  if (cohortAccess &&
      cohortAccess.canAccessPrivateCohorts &&
      cohortAccess.managedGroups &&
      cohortAccess.managedGroups.length > 0) {

    // User can see both public cohorts and their managed private cohorts
    cohortVisibilityMatch = {
      $or: [
        { "cohort_details.visibility": { $ne: false } }, // Public cohorts
        {
          $and: [
            { "cohort_details.visibility": false }, // Private cohorts
            { "cohort_details.groups": { $in: cohortAccess.managedGroups } } // That belong to user's groups
          ]
        }
      ]
    };

    logger.debug(`User has access to private cohorts. Groups: ${cohortAccess.managedGroups.join(', ')}`);
  } else {
    // Standard user can only see public cohorts
    cohortVisibilityMatch = { "cohort_details.visibility": { $ne: false } };
  }

  // Use the modified match condition in the pipeline
  // ... in the aggregation pipeline:
  .match(cohortVisibilityMatch)

  // ... rest of the pipeline ...
}
```

- [ ] Update `fetchData()` function to use cohort access claims
- [ ] Modify the visibility match condition for private cohort access
- [ ] Add appropriate logging for debugging
- [ ] Ensure consistent string format for group matching

#### 4. Update Event Controllers

```javascript
// controllers/events.controller.js
exports.getEvents = async (req, res) => {
  try {
    const filter = buildFilterFromRequest(req);

    // Pass cohort access from middleware to model
    const result = await EventModel(tenant).fetch(filter, req.cohortAccess);

    return res.status(200).json(result);
  } catch (error) {
    logger.error(`Error getting events: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
```

- [ ] Modify controllers to pass cohort access from middleware to models
- [ ] Remove any direct service-to-service API calls
- [ ] Add error handling for access control-related issues

#### 5. Ensure Consistent Group Identifier Format in Cohort Model

```javascript
// In Cohort model
// Add this to normalize groups when saving/updating
cohortSchema.pre("save", function(next) {
  // Normalize group identifiers to lowercase
  if (Array.isArray(this.groups)) {
    this.groups = this.groups.map((group) =>
      typeof group === "string" ? group.toLowerCase().trim() : group
    );
  }
  next();
});
```

- [ ] Add pre-save hook to normalize group identifiers
- [ ] Ensure consistent format (lowercase, trimmed)
- [ ] Consider adding a data migration for existing cohorts

### Phase 3: Testing and Deployment

#### 1. Unit Testing

- [ ] Test JWT token generation with cohort access claims
- [ ] Test JWT extraction with various token scenarios
- [ ] Test aggregation pipeline with different access patterns
- [ ] Verify string normalization and matching

#### 2. Integration Testing

| Test Case                                 | Expected Result                               |
| ----------------------------------------- | --------------------------------------------- |
| User with no groups                       | Can only see public cohorts                   |
| User with groups but no private cohorts   | Can only see public cohorts                   |
| User with groups that own private cohorts | Can see both public and their private cohorts |
| User with invalid/expired token           | Falls back to public-only access              |

- [ ] Create comprehensive test suite for all scenarios
- [ ] Test with real users and cohorts
- [ ] Verify performance impact

#### 3. Rollout Strategy

- [ ] Deploy Auth Service changes first
- [ ] Add feature flag to Device Registry Service for new access control
- [ ] Deploy Device Registry changes with flag off
- [ ] Enable flag for test users/environments
- [ ] Monitor performance and correctness
- [ ] Gradually roll out to all users

## Monitoring and Metrics

Add logging and monitoring for:

- [ ] JWT token size
- [ ] Number of private cohorts accessed
- [ ] Performance impact on queries
- [ ] JWT verification failures
- [ ] Access control decisions (granted/denied)

## Fallback Mechanism

If issues occur with the new access control:

1. Disable feature flag to revert to public-only access
2. Add circuit breaker to JWT verification to gracefully degrade
3. Maintain ability to bypass access control for emergency situations

## Communication Plan

- [ ] Document the new access control mechanism
- [ ] Create diagrams showing the authentication flow
- [ ] Update API documentation to reflect access control changes
- [ ] Prepare FAQ for common issues and troubleshooting

## Resources

- Auth Service repository: [link-to-repo]
- Device Registry Service repository: [link-to-repo]
- JWT documentation: [link-to-docs]
- MongoDB aggregation documentation: [link-to-docs]

---

## Implementation Checklist Summary

- [ ] Phase 1: Auth Service Enhancements (3 tasks)
- [ ] Phase 2: Device Registry Service Enhancements (5 tasks)
- [ ] Phase 3: Testing and Deployment (3 tasks)
- [ ] Monitoring and Metrics Setup
- [ ] Fallback Mechanism Implementation
- [ ] Documentation and Communication

## Timeline

| Phase   | Duration | Dependencies |
| ------- | -------- | ------------ |
| Phase 1 | 1 week   | None         |
| Phase 2 | 2 weeks  | Phase 1      |
| Phase 3 | 1 week   | Phase 2      |
| Total   | 4 weeks  |              |
