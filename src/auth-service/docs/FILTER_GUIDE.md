# Filter System Developer Guide

## Overview

The filter system provides a flexible, type-safe way to build MongoDB query filters from HTTP request parameters. It uses a strategy pattern with field definitions, validation strategies, and specialized builders to handle different entity types. This is a developer guide for `/utils/common/generate-filter.util.js`

## System Architecture

### Core Components

- **FieldRegistry**: Manages field definitions and validation rules
- **ValidationStrategy**: Handles type validation and conversion
- **FilterBuilder**: Constructs MongoDB query filters
- **FilterProcessor**: Orchestrates the entire filtering process
- **CustomProcessors**: Handles complex, entity-specific filtering logic

### Supported Field Types

| Type       | Description                             | Example                      |
| ---------- | --------------------------------------- | ---------------------------- |
| `objectId` | MongoDB ObjectId validation             | `"507f1f77bcf86cd799439011"` |
| `string`   | String validation with trimming         | `"user@example.com"`         |
| `boolean`  | Boolean conversion from various formats | `true`, `"yes"`, `"false"`   |
| `number`   | Integer parsing and validation          | `42`, `"123"`                |

## Adding New Filters

### Step 1: Define Field Mappings

Add your entity's field definitions to `FieldRegistry.fieldDefinitions`:

```javascript
static fieldDefinitions = {
  // ... existing definitions ...

  // New entity definition
  products: {
    product_name: {
      validator: "string",
      mongoField: "name",
      transform: (value) => ({ $regex: value, $options: "i" }) // Case-insensitive search
    },
    price: {
      validator: "number",
      mongoField: "price"
    },
    category_id: {
      validator: "objectId",
      mongoField: "category"
    },
    is_active: {
      validator: "boolean",
      mongoField: "active"
    },
    created_date: {
      validator: "string",
      mongoField: "createdAt",
      transform: (value) => ({ $gte: new Date(value) })
    }
  }
}
```

### Step 2: Choose Filter Builder Type

Add your entity to `FilterFactory.builderMap`:

```javascript
static builderMap = {
  // ... existing mappings ...
  products: BaseFilterBuilder,        // Standard field processing
  // OR
  products: SearchFilterBuilder,      // Text search and array filtering
  // OR
  products: DateRangeFilterBuilder,   // Date range filtering
  // OR
  products: ActivityFilterBuilder,    // Complex activity-based filtering
};
```

### Step 3: Add Public API

Add your filter function to the main filter object:

```javascript
const filter = {
  // ... existing filters ...

  products: (req, next) => FilterProcessor.processFilter("products", req, next),

  // OR with custom processor
  products: (req, next) =>
    FilterProcessor.processFilter(
      "products",
      req,
      next,
      CustomProcessors.products
    ),
};
```

### Step 4: Custom Logic (Optional)

If you need complex business logic, create a custom processor:

```javascript
class CustomProcessors {
  // ... existing processors ...

  static products(builder, data, req, next) {
    // Handle regular fields first
    builder.addMultipleFields(data);

    // Custom logic for complex filtering
    const { price_range, tags, availability } = data;

    if (price_range) {
      const [min, max] = price_range.split("-").map(Number);
      builder.filter.price = { $gte: min, $lte: max };
    }

    if (tags) {
      builder.filter.tags = Array.isArray(tags)
        ? { $all: tags }
        : { $in: tags.split(",") };
    }

    if (availability) {
      builder.filter.stock = { $gt: 0 };
    }

    return builder.build();
  }
}
```

## Field Definition Options

### Basic Field Definition

```javascript
field_name: {
  validator: "string",           // Required: Validation strategy
  mongoField: "mongo_field_name" // Optional: MongoDB field mapping
}
```

### Advanced Field Definition

```javascript
field_name: {
  validator: "string",
  mongoField: "mongo_field_name",
  transform: (value) => {
    // Custom transformation logic
    return processedValue;
  }
}
```

### Common Transform Examples

```javascript
// Case-insensitive regex search
transform: (value) => ({ $regex: value, $options: "i" });

// Date range (greater than or equal)
transform: (value) => ({ $gte: new Date(value) });

// Array matching
transform: (value) => (Array.isArray(value) ? { $all: value } : value);

// String case normalization
transform: (value) => value.toLowerCase();

// Boolean conversion
transform: (value) => (value === "yes" ? true : value === "no" ? false : null);
```

## Filter Builder Types

### BaseFilterBuilder

Best for: Simple field-to-field mappings

```javascript
// Usage
products: BaseFilterBuilder;

// Handles standard field processing automatically
```

### SearchFilterBuilder

Best for: Text search and array filtering

```javascript
// Usage
products: SearchFilterBuilder;

// Provides additional methods:
// - addTextSearch(field, value, options)
// - addArrayFilter(field, value, matchAll)
```

### DateRangeFilterBuilder

Best for: Entities with date/time filtering

```javascript
// Usage
analytics: DateRangeFilterBuilder;

// Provides additional methods:
// - addDateRange(startField, endField, startValue, endValue, next)
```

### ActivityFilterBuilder

Best for: Complex activity-based filtering

```javascript
// Usage
activities: ActivityFilterBuilder;

// Provides additional methods:
// - addTenantValidation(tenant)
// - addServiceFilter(service, dateFilter)
```

## Common Patterns

### Multi-field Search

```javascript
// Field definition
search_term: {
  validator: "string",
  mongoField: "$or",
  transform: (value) => [
    { name: { $regex: value, $options: "i" } },
    { description: { $regex: value, $options: "i" } }
  ]
}
```

### Status Filtering

```javascript
// Field definition
status: {
  validator: "string",
  mongoField: "status",
  transform: (value) => {
    const validStatuses = ["active", "inactive", "pending"];
    return validStatuses.includes(value) ? value : null;
  }
}
```

### Nested Object Filtering

```javascript
// Field definition
user_role: {
  validator: "string",
  mongoField: "user.role"
}
```

### Array Element Matching

```javascript
// Field definition
tag: {
  validator: "string",
  mongoField: "tags",
  transform: (value) => ({ $in: [value] })
}
```

## Best Practices

### 1. Field Naming

- Use consistent naming conventions
- Prefix entity-specific fields when needed
- Use descriptive names that match your API

### 2. Validation Strategy Selection

- Use `objectId` for MongoDB ObjectIds
- Use `string` for text fields
- Use `number` for numeric values
- Use `boolean` for true/false values

### 3. MongoDB Field Mapping

- Always specify `mongoField` if different from the request field
- Use dot notation for nested fields: `"user.email"`
- Consider indexing frequently filtered fields

### 4. Transform Functions

- Keep transforms simple and focused
- Handle edge cases (null, empty strings)
- Use transforms for type conversion and query operators

### 5. Error Handling

- Let the system handle validation errors
- Use custom processors for complex validation
- Log warnings for debugging

## Troubleshooting

### Common Issues

#### 1. Field Not Found Warnings

```
[WARN] No field definition found for products.unknown_field
```

**Solution**: Add field definition or ensure field name is correct

#### 2. Validation Errors

```javascript
// Check validator type matches data type
price: { validator: "number", mongoField: "price" } // Correct
price: { validator: "string", mongoField: "price" }  // Incorrect for numeric data
```

#### 3. Transform Errors

```javascript
// Ensure transform function handles edge cases
transform: (value) => {
  if (!value) return null;
  return value.toLowerCase();
};
```

#### 4. Ignored Fields

If pagination fields are being processed, ensure they're in the ignored list:

```javascript
static ignoredFields = new Set([
  "limit", "skip", "page", "sort", "order", "fields", "populate"
]);
```

### Debugging Tips

1. **Enable Logging**: Check the logs for field processing warnings
2. **Test Incrementally**: Add fields one at a time
3. **Validate Transforms**: Test transform functions with sample data
4. **Check MongoDB Queries**: Use MongoDB debug mode to see generated queries

## Example: Complete Implementation

Here's a complete example for a `products` entity:

```javascript
// 1. Field definitions
static fieldDefinitions = {
  products: {
    name: {
      validator: "string",
      mongoField: "name",
      transform: (value) => ({ $regex: value, $options: "i" })
    },
    price_min: {
      validator: "number",
      mongoField: "price",
      transform: (value) => ({ $gte: value })
    },
    price_max: {
      validator: "number",
      mongoField: "price",
      transform: (value) => ({ $lte: value })
    },
    category_id: {
      validator: "objectId",
      mongoField: "category"
    },
    is_active: {
      validator: "boolean",
      mongoField: "active"
    },
    tags: {
      validator: "string",
      mongoField: "tags",
      transform: (value) => Array.isArray(value) ? { $all: value } : value
    }
  }
}

// 2. Builder mapping
static builderMap = {
  products: SearchFilterBuilder,
}

// 3. Public API
const filter = {
  products: (req, next) => FilterProcessor.processFilter("products", req, next),
}

// 4. Usage example
// GET /api/products?name=laptop&price_min=100&price_max=500&category_id=507f1f77bcf86cd799439011&is_active=true
// Generates MongoDB query:
// {
//   name: { $regex: "laptop", $options: "i" },
//   price: { $gte: 100, $lte: 500 },
//   category: ObjectId("507f1f77bcf86cd799439011"),
//   active: true
// }
```

This guide should help you efficiently add new filters to the system while maintaining consistency and best practices.
