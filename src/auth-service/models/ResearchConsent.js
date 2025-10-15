const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = mongoose.ObjectId;
const constants = require("@config/constants");
const { addDays } = require("@utils/common");
const { getModelByTenant } = require("@config/database");
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
} = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- research-consent-model`
);

const ConsentTypesSchema = new Schema(
  {
    locationTracking: {
      type: String,
      enum: ["granted", "denied", "notProvided"],
      default: "notProvided",
    },
    surveyParticipation: {
      type: String,
      enum: ["granted", "denied", "notProvided"],
      default: "notProvided",
    },
    alertResponses: {
      type: String,
      enum: ["granted", "denied", "notProvided"],
      default: "notProvided",
    },
    dataSharing: {
      type: String,
      enum: ["granted", "denied", "notProvided"],
      default: "notProvided",
    },
    researchCommunication: {
      type: String,
      enum: ["granted", "denied", "notProvided"],
      default: "notProvided",
    },
  },
  { _id: false }
);

const ResearchConsentSchema = new Schema(
  {
    userId: {
      type: ObjectId,
      ref: "user",
      required: [true, "User ID is required"],
      unique: true,
      index: true,
    },
    consentTypes: {
      type: ConsentTypesSchema,
      default: () => ({}),
    },
    consentVersion: {
      type: String,
      required: [true, "Consent version is required"],
    },
    hasCompletedOnboarding: {
      type: Boolean,
      default: false,
    },
    studyStatus: {
      type: String,
      enum: ["active", "withdrawn", "completed", "paused"],
      default: "active",
    },
    withdrawalReason: { type: String, trim: true },
    withdrawalDate: { type: Date },
    dataDeletionScheduledFor: { type: Date },
    initialConsentDate: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ResearchConsentSchema.statics = {
  async register(args) {
    try {
      const data = await this.create({ ...args });
      return createSuccessResponse("create", data, "research consent");
    } catch (error) {
      logger.error(`Error on register research consent: ${error.message}`);
      return createErrorResponse(error, "register", logger, "research consent");
    }
  },
  async findConsent({ filter = {}, skip = 0, limit = 1000 } = {}) {
    try {
      const consent = await this.findOne(filter).lean();
      if (!consent) {
        return createNotFoundResponse("research consent", "get");
      }
      return createSuccessResponse("get", consent, "research consent");
    } catch (error) {
      logger.error(`Error on findConsent: ${error.message}`);
      return createErrorResponse(error, "get", logger, "research consent");
    }
  },
  async updateConsent({ filter = {}, update = {} } = {}) {
    try {
      const options = { new: true };
      const updatedConsent = await this.findOneAndUpdate(
        filter,
        update,
        options
      );
      if (!updatedConsent) {
        return createNotFoundResponse("research consent", "update");
      }
      return createSuccessResponse(
        "update",
        updatedConsent,
        "research consent"
      );
    } catch (error) {
      logger.error(`Error on updateConsent: ${error.message}`);
      return createErrorResponse(error, "update", logger, "research consent");
    }
  },
  async withdraw({ filter = {}, withdrawalInfo = {} } = {}) {
    try {
      const options = { new: true };
      const { withdrawalReason, additionalComments, timestamp } =
        withdrawalInfo;

      const update = {
        $set: {
          studyStatus: "withdrawn",
          withdrawalReason: withdrawalReason,
          withdrawalDate: timestamp || new Date(),
          "consentTypes.locationTracking": "denied",
          "consentTypes.surveyParticipation": "denied",
          "consentTypes.alertResponses": "denied",
          "consentTypes.dataSharing": "denied",
          "consentTypes.researchCommunication": "denied",
          dataDeletionScheduledFor: addDays(new Date(), 30), // Schedule deletion in 30 days
        },
      };

      const withdrawnConsent = await this.findOneAndUpdate(
        filter,
        update,
        options
      );

      if (!withdrawnConsent) {
        return createNotFoundResponse("research consent", "withdraw from");
      }

      return createSuccessResponse(
        "withdraw",
        withdrawnConsent,
        "research consent"
      );
    } catch (error) {
      logger.error(`Error on withdraw from study: ${error.message}`);
      return createErrorResponse(error, "withdraw", logger, "research consent");
    }
  },
};

const ResearchConsentModel = (tenant) => {
  try {
    return mongoose.model("researchconsents");
  } catch (error) {
    return getModelByTenant(tenant, "researchconsent", ResearchConsentSchema);
  }
};

module.exports = ResearchConsentModel;
