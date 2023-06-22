const logicGroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    // Additional fields specific to LogicGroups
    // ...
  },
  { timestamps: true }
);

const LogicGroup = mongoose.model("LogicGroup", logicGroupSchema);
