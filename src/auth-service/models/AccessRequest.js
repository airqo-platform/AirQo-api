const AccessRequestSchema = new Schema(
  {
    user: {
      type: ObjectId,
      ref: "user",
      required: [true, "User ID is required"],
    },
    requestType: {
      type: String,
      enum: ["network", "group"],
      required: [true, "Request type is required"],
    },
    targetId: {
      type: ObjectId,
      required: [true, "Target ID is required"],
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    // Additional fields for comments, timestamps, etc.
  },
  {
    timestamps: true,
  }
);
screenX;
