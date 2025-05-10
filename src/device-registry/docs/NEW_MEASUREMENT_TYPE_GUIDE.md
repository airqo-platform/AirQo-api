### How to Add a New Measurement Type:

When you need to add a new pollutant or sensor type to the system, you now only need to make changes in one place. Here's an example of how to add a new pollutant called "O3" (ozone):

1. Open `measurement-registry.js`
2. Add a new entry to the `MEASUREMENT_REGISTRY` object:

```javascript
o3: {
  name: "O3",
  description: "Ozone",
  schema: {
    value: { type: Number, default: null },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  mappings: {
    value: "o3_raw_value",
    calibratedValue: "o3_calibrated_value",
    uncertaintyValue: "o3_uncertainty_value",
    standardDeviationValue: "o3_standard_deviation_value",
  },
  isPollutant: true,
  includeInAggregation: true,
  unit: "ppb",
  category: "gas",
},
```

That's it! The rest of your code will automatically use this new measurement type because:

1. The schema will be generated automatically from the registry
2. Mappings for transformations will include the new pollutant
3. Default values will be handled correctly
4. All utilities will recognize it as a valid pollutant
5. It will be included in aggregation pipelines where appropriate

### Additional Benefits:

1. **Improved Readability**: The code is now more self-documenting because the structure of measurements is clearly defined in one place
2. **Better Maintenance**: When requirements change, you only need to update one file
3. **Easier Testing**: You can test measurement handling with known registry inputs
4. **Reduced Errors**: Consistent handling of measurement types across your codebase

### Future Enhancements:

1. **Validation Rules**: Add measurement-specific validation rules to the registry
2. **Conversion Functions**: Include unit conversion functions in the registry
3. **Documentation Generation**: Auto-generate API documentation from the registry
4. **Visualization Preferences**: Add visualization settings for each measurement type
