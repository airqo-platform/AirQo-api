const geoGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    location: {
      type: polygonSchema,
      required: true,
    },
    // Additional fields specific to GeoGroups
    // ...
  },
  { timestamps: true }
);

const GeoGroup = mongoose.model("GeoGroup", geoGroupSchema);
