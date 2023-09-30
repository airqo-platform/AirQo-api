/*
Changes made to `valueSchema` schema may affect the format of messages 
received from the message broker (Kafka). Consider updating 
the schema `AirQo-api/kafka/schemas/transformed-device-measurements.avsc`
and following up on its deployment. :)
*/
const mongoose = require("mongoose");
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("@utils/log");
const ObjectId = Schema.Types.ObjectId;
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- event-model`
);
const DEFAULT_LIMIT = 100;
const DEFAULT_SKIP = 0;
const DEFAULT_PAGE = 1;
const valueSchema = new Schema({
  time: {
    type: Date,
    required: [true, "the timestamp is required"],
  },
  frequency: {
    type: String,
    required: [true, "the frequency is required"],
    trim: true,
  },
  is_test_data: {
    type: Boolean,
    trim: true,
  },
  /**** */
  device: {
    type: String,
    trim: true,
    default: null,
  },
  tenant: {
    type: String,
    trim: true,
  },
  network: {
    type: String,
    trim: true,
  },
  is_device_primary: {
    type: Boolean,
    trim: true,
  },
  device_id: {
    type: ObjectId,
    required: [true, "The device ID is required"],
  },
  device_number: {
    type: Number,
    default: null,
  },
  site: {
    type: String,
    default: null,
  },
  site_id: {
    type: ObjectId,
  },
  /**** */
  pm1: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s1_pm1: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s2_pm1: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  pm2_5: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s1_pm2_5: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s2_pm2_5: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s1_pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  s2_pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  no2: {
    value: {
      type: Number,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  battery: {
    value: {
      type: Number,
      default: null,
    },
  },
  location: {
    latitude: {
      value: {
        type: Number,
        default: null,
      },
    },
    longitude: {
      value: {
        type: Number,
        default: null,
      },
    },
  },
  altitude: {
    value: {
      type: Number,
      default: null,
    },
  },
  speed: {
    value: {
      type: Number,
      default: null,
    },
  },
  satellites: {
    value: {
      type: Number,
      default: null,
    },
  },
  hdop: {
    value: {
      type: Number,
      default: null,
    },
  },
  internalTemperature: {
    value: {
      type: Number,
      default: null,
    },
  },
  internalHumidity: {
    value: {
      type: Number,
      default: null,
    },
  },
  externalTemperature: {
    value: {
      type: Number,
      default: null,
    },
  },
  externalHumidity: {
    value: {
      type: Number,
      default: null,
    },
  },
  average_pm2_5: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  average_pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  externalPressure: {
    value: { type: Number, default: null },
  },
  externalAltitude: {
    value: {
      type: Number,
      default: null,
    },
  },
  rtc_adc: {
    value: {
      type: Number,
      default: null,
    },
  },
  rtc_v: {
    value: {
      type: Number,
      default: null,
    },
  },
  rtc: {
    value: {
      type: Number,
      default: null,
    },
  },
  stc_adc: {
    value: {
      type: Number,
      default: null,
    },
  },
  stc_v: {
    value: {
      type: Number,
      default: null,
    },
  },
  stc: {
    value: {
      type: Number,
      default: null,
    },
  },
});

const eventSchema = new Schema(
  {
    day: {
      type: String,
      required: [true, "the day is required"],
    },
    device: {
      type: String,
      trim: true,
      default: null,
    },
    network: {
      type: String,
      trim: true,
      default: "airqo",
    },
    tenant: {
      type: String,
      trim: true,
      default: "airqo",
    },
    is_device_primary: {
      type: Boolean,
      trim: true,
    },
    device_id: {
      type: ObjectId,
    },
    device_number: {
      type: Number,
      default: null,
    },
    site: {
      type: String,
      default: null,
    },
    site_id: {
      type: ObjectId,
    },
    first: {
      type: Date,
      required: [true, "the first day's event is required"],
    },
    last: {
      type: Date,
      required: [true, "the last day's event is required"],
    },
    nValues: {
      type: Number,
      required: [true, "the nValues is required"],
    },
    values: [valueSchema],
  },
  {
    timestamps: true,
  }
);

eventSchema.index(
  {
    "values.time": 1,
    device_id: 1,
    site_id: 1,
    "values.frequency": 1,
    day: 1,
  },
  {
    unique: true,
    partialFilterExpression: { nValues: { $lt: parseInt(constants.N_VALUES) } },
  }
);

eventSchema.index(
  {
    "values.time": 1,
    "values.device": 1,
    "values.device_id": 1,
    "values.site_id": 1,
    day: 1,
    "values.frequency": 1,
  },
  {
    unique: true,
    partialFilterExpression: { nValues: { $lt: parseInt(constants.N_VALUES) } },
  }
);

eventSchema.index(
  {
    "values.time": 1,
    "values.site_id": 1,
    day: 1,
    "values.frequency": 1,
  },
  {
    unique: true,
    partialFilterExpression: { nValues: { $lt: parseInt(constants.N_VALUES) } },
  }
);

eventSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

eventSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

eventSchema.methods = {
  toJSON() {
    return {
      day: this.day,
      values: this.values,
    };
  },
};

const elementAtIndexName = (metadata, recent) => {
  if (metadata === "site" || metadata === "site_id") {
    if (!recent || recent === "yes") {
      return { $first: { $arrayElemAt: ["$siteDetails", 0] } };
    }
    if (recent === "no") {
      return { $arrayElemAt: ["$siteDetails", 0] };
    }
  }

  if (!metadata || metadata === "device" || metadata === "device_id") {
    if (!recent || recent === "yes") {
      return { $first: { $arrayElemAt: ["$deviceDetails", 0] } };
    }
    if (recent === "no") {
      return { $arrayElemAt: ["$deviceDetails", 0] };
    }
  }
};

const getConfiguredProjection = (metadata, brief) => {
  const projection = {
    _id: 0, // Always exclude _id by default
  };

  // Customize projection based on metadata
  if (!metadata || metadata === "device" || metadata === "device_id") {
    // Customize projection for device metadata
    projection.device = 1; // Include device field
    projection.device_id = 1; // Include device_id field

    if (metadata === "device_id") {
      projection.foreignField = "_id";
    } else if (metadata === "device" || !metadata) {
      projection.foreignField = "name";
    }

    // Add more fields as needed for device metadata
  } else if (metadata === "site_id" || metadata === "site") {
    // Customize projection for site metadata
    projection.site = 1; // Include site field
    projection.site_id = 1; // Include site_id field

    if (metadata === "site") {
      projection.foreignField = "generated_name";
    } else if (metadata === "site_id") {
      projection.foreignField = "_id";
    }

    // Add more fields as needed for site metadata
  }

  // Customize projection based on brief flag
  if (brief === "yes") {
    // Customize projection for brief flag
    projection.additionalField = 1; // Include additionalField when brief is "yes"

    // Add more fields as needed for brief flag
  }

  // Add more customizations based on your requirements

  return projection;
};

const getGroupDetails = (filter) => {
  const groupDetails = {};
  const { metadata } = filter;
  // Customize groupId, localField, foreignField, etc. based on metadata
  if (metadata === "device" || !metadata) {
    groupDetails.groupId = "$device";
    groupDetails.localField = "device";
    groupDetails.foreignField = "name";
  } else if (metadata === "site_id" || metadata === "site") {
    groupDetails.groupId = "$" + metadata;
    groupDetails.localField = metadata;
    if (metadata === "site") {
      groupDetails.foreignField = "generated_name";
    } else if (metadata === "site_id") {
      groupDetails.foreignField = "_id";
    }
  }

  // Customize other group details based on filter or additional conditions
  if (filter && filter.running === "yes") {
    // Customize group details for running devices
    groupDetails.someOtherField = "someValue";
  }

  // Add more customizations based on your requirements

  return groupDetails;
};

const createMatchQuery = (filter) => {
  const matchQuery = {};

  if (filter.metadata) {
    matchQuery.metadata = filter.metadata;
  }

  if (filter.frequency) {
    matchQuery.frequency = filter.frequency;
  }

  if (filter.external) {
    matchQuery.external = filter.external;
  }

  if (filter.tenant) {
    matchQuery.tenant = filter.tenant;
  }

  if (filter.device) {
    matchQuery.device = filter.device;
  }

  if (filter.running) {
    matchQuery.running = filter.running;
  }

  if (filter.recent) {
    matchQuery.recent = filter.recent;
  }

  if (filter.brief) {
    matchQuery.brief = filter.brief;
  }

  if (filter.index) {
    matchQuery.index = filter.index;
  }

  // Add more conditions based on your filter properties

  return matchQuery;
};

const createSortQuery = (index) => {
  let sortField;
  let sortOrder;

  switch (index) {
    case 0:
      // Sort by field 1 in ascending order
      sortField = "field1";
      sortOrder = 1;
      break;
    case 1:
      // Sort by field 2 in descending order
      sortField = "field2";
      sortOrder = -1;
      break;
    // Add more cases as needed for different indices
    default:
      // Default sorting if the index doesn't match any case
      sortField = "defaultField";
      sortOrder = 1; // You can change the order as needed
      break;
  }

  return {
    $sort: {
      [sortField]: sortOrder,
    },
  };
};

const createFacetProjection = () => {
  return [
    {
      $facet: {
        total: [{ $count: "device" }],
        data: [
          {
            $addFields: {
              device: "$device",
              // Add other fields as needed
            },
          },
        ],
      },
    },
    {
      $project: {
        meta,
        data: {
          $slice: [
            "$data",
            skip,
            {
              $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
            },
          ],
        },
      },
    },
  ];
};

const createPipelineForRecent = (search, projection, sort, filter) => {
  const { groupId, localField, foreignField, from, as, _as } = getGroupDetails(
    filter
  );
  const pipeline = [
    {
      $unwind: "$values",
    },
    {
      $match: search,
    },
    {
      $replaceRoot: {
        newRoot: "$values",
      },
    },
    {
      $lookup: {
        from: "photos",
        localField: "site_id",
        foreignField: "site_id",
        as: "site_images",
      },
    },
    {
      $lookup: {
        from: "devices",
        localField: localField,
        foreignField: foreignField,
        as: as,
      },
    },
    {
      $sort: sort,
    },
    {
      $group: {
        _id: groupId,
        device: { $first: "$device" },
        device_id: { $first: "$device_id" },
        // ... other fields to group
        [as]: elementAtIndex0,
      },
    },
    {
      $project: projection,
    },
    {
      $facet: {
        total: [{ $count: "device" }],
        data: [
          {
            $addFields: {
              device: "$device",
              // ... other fields to add
            },
          },
        ],
      },
    },
    {
      $project: {
        meta,
        data: {
          $slice: [
            "$data",
            skip,
            {
              $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
            },
          ],
        },
      },
    },
    {
      $allowDiskUse: true,
    },
  ];

  pipeline.push({
    $group: {
      _id: groupId,
      [localField]: {
        $first: `$${localField}`, // Use localField obtained from getGroupDetails
      },
      [foreignField]: {
        $first: `$${foreignField}`, // Use foreignField obtained from getGroupDetails
      },
      // Replace 'collection' with 'from' from getGroupDetails
      [from]: {
        $first: `$${from}`,
      },
      // ...other group stage configurations
      [as]: {
        $first: `$${as}`, // Use as obtained from getGroupDetails
      },
      [_as]: {
        $first: `$${_as}`, // Use _as obtained from getGroupDetails
      },
    },
  });

  return pipeline;
};

const createPipelineForNonRecent = (search, projection, sort) => {
  return [
    {
      $unwind: "$values",
    },
    {
      $match: search,
    },
    {
      $replaceRoot: {
        newRoot: "$values",
      },
    },
    {
      $lookup: {
        from: from,
        localField: localField,
        foreignField: foreignField,
        as: as,
      },
    },
    {
      $sort: sort,
    },
    {
      $project: projection,
    },
    {
      $facet: {
        total: [{ $count: "device" }],
        data: [
          {
            $addFields: {
              device: "$device",
              // ... other fields to add
            },
          },
        ],
      },
    },
    {
      $project: {
        meta,
        data: {
          $slice: [
            "$data",
            skip,
            {
              $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
            },
          ],
        },
      },
    },
    {
      $allowDiskUse: true,
    },
  ];
};

eventSchema.statics = {
  createEvent(args) {
    return this.create({
      ...args,
    });
  },
  async list({
    skip = DEFAULT_SKIP,
    limit = DEFAULT_LIMIT,
    filter = {},
    page = DEFAULT_PAGE,
  } = {}) {
    try {
      const {
        metadata,
        external,
        tenant,
        running,
        recent,
        brief,
        index,
      } = filter;

      logObject("filter", filter);

      let search = filter;
      let groupId = "$device";
      let localField = "device";
      let foreignField = "name";
      let from = "devices";
      let _as = "_deviceDetails";
      let as = "deviceDetails";
      let pm2_5 = "$average_pm2_5";
      let pm10 = "$average_pm10";
      let s1_pm2_5 = "$pm2_5";
      let s1_pm10 = "$pm10";
      let elementAtIndex0 = elementAtIndexName(metadata, recent);
      let projection = {
        _id: 0,
      };
      let meta = {
        total: { $arrayElemAt: ["$total.device", 0] },
        skip: { $literal: skip },
        limit: { $literal: limit },
        page: {
          $trunc: {
            $literal: skip / limit + 1,
          },
        },
        pages: {
          $ifNull: [
            {
              $ceil: {
                $divide: [{ $arrayElemAt: ["$total.device", 0] }, limit],
              },
            },
            1,
          ],
        },
      };
      let siteProjection = {};
      let deviceProjection = {};
      let sort = { time: -1 };

      delete search["external"];
      delete search["frequency"];
      delete search["metadata"];
      delete search["tenant"];
      delete search["device"];
      delete search["recent"];
      delete search["page"];
      delete search["running"];
      delete search["brief"];
      delete search["index"];

      /**
       * The Alternative Flows present in this Events entity:
       * 1. Based on tenant, which PM values should we showcase?
       * 2. Which metadata should we show? Sites or Devices? etc....
       * 3. Should we show recent or historical measurements?
       */
      if (tenant !== "airqo") {
        pm2_5 = "$pm2_5";
        pm10 = "$pm10";
      }

      if (external === "yes" || brief === "yes") {
        projection["s2_pm10"] = 0;
        projection["s1_pm10"] = 0;
        projection["s2_pm2_5"] = 0;
        projection["s1_pm2_5"] = 0;
        projection["rtc_adc"] = 0;
        projection["rtc_v"] = 0;
        projection["rtc"] = 0;
        projection["stc_adc"] = 0;
        projection["stc_v"] = 0;
        projection["stc"] = 0;
        projection["no2"] = 0;
        projection["pm1"] = 0;
        projection["pm10"] = 0;
        projection["externalHumidity"] = 0;
        projection["externalAltitude"] = 0;
        projection["internalHumidity"] = 0;
        projection["externalTemperature"] = 0;
        projection["internalTemperature"] = 0;
        projection["hdop"] = 0;
        projection["satellites"] = 0;
        projection["speed"] = 0;
        projection["altitude"] = 0;
        projection["location"] = 0;
        projection["network"] = 0;
        projection["battery"] = 0;
        projection["average_pm10"] = 0;
        projection["average_pm2_5"] = 0;
        projection["device_number"] = 0;
        projection["pm2_5.uncertaintyValue"] = 0;
        projection["pm2_5.standardDeviationValue"] = 0;
        projection["site"] = 0;
        projection[as] = 0;
      }

      if (!metadata || metadata === "device" || metadata === "device_id") {
        groupId = "$" + metadata ? metadata : groupId;
        localField = metadata ? metadata : localField;
        if (metadata === "device_id") {
          foreignField = "_id";
        }
        if (metadata === "device" || !metadata) {
          foreignField = "name";
        }

        from = "devices";
        _as = "_deviceDetails";
        as = "deviceDetails";
        elementAtIndex0 = elementAtIndexName(metadata, recent);
        deviceProjection = constants.EVENTS_METADATA_PROJECTION("device", as);
        Object.assign(projection, deviceProjection);
      }

      if (metadata === "site_id" || metadata === "site") {
        groupId = "$" + metadata;
        localField = metadata;
        if (metadata === "site") {
          foreignField = "generated_name";
        }
        if (metadata === "site_id") {
          foreignField = "_id";
        }
        from = "sites";
        _as = "_siteDetails";
        as = "siteDetails";
        elementAtIndex0 = elementAtIndexName(metadata, recent);

        if (brief === "yes") {
          siteProjection = constants.EVENTS_METADATA_PROJECTION(
            "brief_site",
            as
          );
        } else {
          siteProjection = constants.EVENTS_METADATA_PROJECTION("site", as);
        }
        Object.assign(projection, siteProjection);
      }

      if (running === "yes") {
        delete projection["pm2_5.uncertaintyValue"];
        delete projection["pm2_5.standardDeviationValue"];

        Object.assign(projection, {
          site_image: 0,
          is_reading_primary: 0,
          deviceDetails: 0,
          aqi_color: 0,
          aqi_category: 0,
          aqi_color_name: 0,
          pm2_5: 0,
          average_pm10: 0,
          pm10: 0,
          frequency: 0,
          network: 0,
          location: 0,
          altitude: 0,
          speed: 0,
          satellites: 0,
          hdop: 0,
          internalTemperature: 0,
          externalTemperature: 0,
          internalHumidity: 0,
          externalHumidity: 0,
          externalAltitude: 0,
          pm1: 0,
          no2: 0,
          site: 0,
          site_id: 0,
          health_tips: 0,
          s1_pm2_5: 0,
          s2_pm2_5: 0,
          s1_pm10: 0,
          s2_pm10: 0,
          battery: 0,
          rtc_adc: 0,
          rtc_v: 0,
          rtc: 0,
          stc_adc: 0,
          stc_v: 0,
          stc: 0,
          siteDetails: 0,
          aqi_color: 0,
          aqi_category: 0,
          aqi_color_name: 0,
        });
      }

      if (!isEmpty(index)) {
        sort = { "pm2_5.value": 1 };
      }

      logObject("the query for this request", search);
      if (!recent || recent === "yes") {
        const data = await this.aggregate()
          .unwind("values")
          .match(search)
          .replaceRoot("values")
          .lookup({
            from: "photos",
            localField: "site_id",
            foreignField: "site_id",
            as: "site_images",
          })
          .lookup({
            from: "devices",
            localField: "device_id",
            foreignField: "_id",
            as: "device_details",
          })
          .lookup({
            from,
            localField,
            foreignField,
            as,
          })
          .lookup({
            from: "healthtips",
            let: { pollutantValue: { $toInt: "$pm2_5.value" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {
                        $lte: ["$aqi_category.min", "$$pollutantValue"],
                      },
                      {
                        $gte: ["$aqi_category.max", "$$pollutantValue"],
                      },
                    ],
                  },
                },
              },
            ],
            as: "healthTips",
          })
          .sort(sort)
          .group({
            _id: "$device",
            device: { $first: "$device" },
            device_id: { $first: "$device_id" },
            site_image: {
              $first: { $arrayElemAt: ["$site_images.image_url", 0] },
            },
            is_reading_primary: {
              $first: {
                $arrayElemAt: ["$device_details.isPrimaryInLocation", 0],
              },
            },
            device_number: { $first: "$device_number" },
            health_tips: { $first: "$healthTips" },
            site: { $first: "$site" },
            site_id: { $first: "$site_id" },
            time: { $first: "$time" },
            average_pm2_5: { $first: "$average_pm2_5" },
            pm2_5: { $first: pm2_5 },
            s1_pm2_5: { $first: s1_pm2_5 },
            s2_pm2_5: { $first: "$s2_pm2_5" },
            average_pm10: { $first: "$average_pm10" },
            pm10: { $first: pm10 },
            s1_pm10: { $first: s1_pm10 },
            s2_pm10: { $first: "$s2_pm10" },
            frequency: { $first: "$frequency" },
            battery: { $first: "$battery" },
            network: { $first: "$network" },
            location: { $first: "$location" },
            altitude: { $first: "$altitude" },
            speed: { $first: "$speed" },
            satellites: { $first: "$satellites" },
            hdop: { $first: "$hdop" },
            internalTemperature: { $first: "$internalTemperature" },
            externalTemperature: { $first: "$externalTemperature" },
            internalHumidity: { $first: "$internalHumidity" },
            externalHumidity: { $first: "$externalHumidity" },
            externalAltitude: { $first: "$externalAltitude" },
            pm1: { $first: "$pm1" },
            no2: { $first: "$no2" },
            rtc_adc: { $first: "$rtc_adc" },
            rtc_v: { $first: "$rtc_v" },
            rtc: { $first: "$rtc" },
            stc_adc: { $first: "$stc_adc" },
            stc_v: { $first: "$stc_v" },
            stc: { $first: "$stc" },
            [as]: elementAtIndex0,
          })

          .project({
            "health_tips.aqi_category": 0,
            "health_tips.value": 0,
            "health_tips.createdAt": 0,
            "health_tips.updatedAt": 0,
            "health_tips.__v": 0,
          })
          .project({
            "site_image.createdAt": 0,
            "site_image.updatedAt": 0,
            "site_image.metadata": 0,
            "site_image.__v": 0,
            "site_image.device_name": 0,
            "site_image.device_id": 0,
            "site_image._id": 0,
            "site_image.tags": 0,
            "site_image.image_code": 0,
            "site_image.site_id": 0,
            "site_image.airqloud_id": 0,
          })
          .project(projection)
          .facet({
            total: [{ $count: "device" }],
            data: [
              {
                $addFields: {
                  device: "$device",
                  aqi_color: {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $and: [
                              { $gte: ["$pm2_5.value", 0] },
                              { $lt: ["$pm2_5.value", 12.1] },
                            ],
                          },
                          then: "00e400",
                        },
                        {
                          case: {
                            $and: [
                              { $gte: ["$pm2_5.value", 12.1] },
                              { $lt: ["$pm2_5.value", 35.5] },
                            ],
                          },
                          then: "ffff00",
                        },
                        {
                          case: {
                            $and: [
                              { $gte: ["$pm2_5.value", 35.5] },
                              { $lt: ["$pm2_5.value", 55.5] },
                            ],
                          },
                          then: "ff7e00",
                        },
                        {
                          case: {
                            $and: [
                              { $gte: ["$pm2_5.value", 55.5] },
                              { $lt: ["$pm2_5.value", 150.5] },
                            ],
                          },
                          then: "ff0000",
                        },
                        {
                          case: {
                            $and: [
                              { $gte: ["$pm2_5.value", 150.5] },
                              { $lt: ["$pm2_5.value", 250.5] },
                            ],
                          },
                          then: "8f3f97",
                        },
                        {
                          case: { $gte: ["$pm2_5.value", 250.5] },
                          then: "7e0023",
                        },
                      ],
                      default: "Unknown",
                    },
                  },

                  aqi_category: {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $and: [
                              { $gte: ["$pm2_5.value", 0] },
                              { $lte: ["$pm2_5.value", 12] },
                            ],
                          },
                          then: "Good",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 12] },
                              { $lte: ["$pm2_5.value", 35.4] },
                            ],
                          },
                          then: "Moderate",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 35.4] },
                              { $lte: ["$pm2_5.value", 55.4] },
                            ],
                          },
                          then: "Unhealthy for Sensitive Groups",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 55.4] },
                              { $lte: ["$pm2_5.value", 150.4] },
                            ],
                          },
                          then: "Unhealthy",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 150.4] },
                              { $lte: ["$pm2_5.value", 250.4] },
                            ],
                          },
                          then: "Very Unhealthy",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 250.4] },
                              { $lte: ["$pm2_5.value", 500] },
                            ],
                          },
                          then: "Hazardous",
                        },
                      ],
                      default: "Unknown",
                    },
                  },
                  aqi_color_name: {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $and: [
                              { $gte: ["$pm2_5.value", 0] },
                              { $lte: ["$pm2_5.value", 12] },
                            ],
                          },
                          then: "Green",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 12] },
                              { $lte: ["$pm2_5.value", 35.4] },
                            ],
                          },
                          then: "Yellow",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 35.4] },
                              { $lte: ["$pm2_5.value", 55.4] },
                            ],
                          },
                          then: "Orange",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 55.4] },
                              { $lte: ["$pm2_5.value", 150.4] },
                            ],
                          },
                          then: "Red",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 150.4] },
                              { $lte: ["$pm2_5.value", 250.4] },
                            ],
                          },
                          then: "Purple",
                        },
                        {
                          case: {
                            $and: [
                              { $gt: ["$pm2_5.value", 250.4] },
                              { $lte: ["$pm2_5.value", 500] },
                            ],
                          },
                          then: "Maroon",
                        },
                      ],
                      default: "Unknown",
                    },
                  },
                },
              },
            ],
          })
          .project({
            meta,
            data: {
              $slice: [
                "$data",
                skip,
                {
                  $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
                },
              ],
            },
          })
          .allowDiskUse(true);
        return {
          success: true,
          data,
          message: "successfully returned the measurements",
          status: HTTPStatus.OK,
        };
      }

      if (recent === "no") {
        let data = await this.aggregate()
          .unwind("values")
          .match(search)
          .replaceRoot("values")
          .lookup({
            from,
            localField,
            foreignField,
            as,
          })
          .sort(sort)
          .project({
            _device: "$device",
            _time: "$time",
            _average_pm2_5: "$average_pm2_5",
            _pm2_5: pm2_5,
            _s1_pm2_5: s1_pm2_5,
            _s2_pm2_5: "$s2_pm2_5",
            _average_pm10: "$average_pm10",
            _pm10: pm10,
            _s1_pm10: s1_pm10,
            _s2_pm10: "$s2_pm10",
            _frequency: "$frequency",
            _battery: "$battery",
            _location: "$location",
            _altitude: "$altitude",
            _speed: "$speed",
            _network: "$network",
            _satellites: "$satellites",
            _hdop: "$hdop",
            _site_id: "$site_id",
            _device_id: "$device_id",
            _site: "$site",
            _device_number: "$device_number",
            _internalTemperature: "$internalTemperature",
            _externalTemperature: "$externalTemperature",
            _internalHumidity: "$internalHumidity",
            _externalHumidity: "$externalHumidity",
            _externalAltitude: "$externalAltitude",
            _pm1: "$pm1",
            _no2: "$no2",
            _rtc_adc: "$rtc_adc",
            _rtc_v: "$rtc_v",
            _rtc: "$rtc",
            _stc_adc: "$stc_adc",
            _stc_v: "$stc_v",
            _stc: "$stc",
            [_as]: elementAtIndex0,
          })
          .project({
            device: "$_device",
            device_id: "$_device_id",
            device_number: "$_device_number",
            site: "$_site",
            site_id: "$_site_id",
            time: "$_time",
            average_pm2_5: "$_average_pm2_5",
            pm2_5: "$_pm2_5",
            s1_pm2_5: "$_s1_pm2_5",
            s2_pm2_5: "$_s2_pm2_5",
            average_pm10: "$_average_pm10",
            pm10: "$_pm10",
            s1_pm10: "$_s1_pm10",
            s2_pm10: "$_s2_pm10",
            frequency: "$_frequency",
            battery: "$_battery",
            location: "$_location",
            altitude: "$_altitude",
            speed: "$_speed",
            network: "$_network",
            satellites: "$_satellites",
            hdop: "$_hdop",
            internalTemperature: "$_internalTemperature",
            externalTemperature: "$_externalTemperature",
            internalHumidity: "$_internalHumidity",
            externalHumidity: "$_externalHumidity",
            externalAltitude: "$_externalAltitude",
            pm1: "$_pm1",
            no2: "$_no2",
            rtc_adc: "$_rtc_adc",
            rtc_v: "$_rtc_v",
            rtc: "$_rtc",
            stc_adc: "$_stc_adc",
            stc_v: "$_stc_v",
            stc: "$_stc",
            [as]: "$" + _as,
          })
          .project(projection)
          .facet({
            total: [{ $count: "device" }],
            data: [
              {
                $addFields: { device: "$device" },
              },
            ],
          })
          .project({
            meta,
            data: {
              $slice: [
                "$data",
                skip,
                {
                  $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
                },
              ],
            },
          })
          .allowDiskUse(true);
        return {
          success: true,
          message: "successfully returned the measurements",
          data,
          status: HTTPStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`list events -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

eventSchema.statics.view = async ({
  skip = DEFAULT_SKIP,
  limit = DEFAULT_LIMIT,
  filter = {},
  page = DEFAULT_PAGE,
} = {}) => {
  try {
    const { metadata, external, tenant, recent, brief, index } = filter;
    const projection = getConfiguredProjection(metadata, brief);
    const matchQuery = createMatchQuery(filter);
    const sortQuery = createSortQuery(index);
    const facetProjection = createFacetProjection();
    let pipeline;

    if (!recent || recent === "yes") {
      pipeline = createPipelineForRecent(
        matchQuery,
        projection,
        sortQuery,
        filter
      );
    } else {
      pipeline = createPipelineForNonRecent(matchQuery, projection, sortQuery);
    }

    // Add the $facet stage to the pipeline to include facetProjection
    pipeline.push({
      $facet: {
        data: [
          {
            $project: facetProjection,
          },
        ],
        total: [
          {
            $count: "device",
          },
        ],
      },
    });

    // Execute the aggregation pipeline
    const data = await this.aggregate(pipeline);

    return {
      success: true,
      data,
      message: "successfully returned the measurements",
      status: HTTPStatus.OK,
    };
  } catch (error) {
    logger.error(`list events -- ${error.message}`);
    logObject("error", error);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: HTTPStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const eventsModel = (tenant) => {
  try {
    const events = mongoose.model("events");
    return events;
  } catch (error) {
    logObject("tenant.toLowerCase()", tenant.toLowerCase());
    return getModelByTenant(tenant.toLowerCase(), "event", eventSchema);
  }
};

module.exports = eventsModel;
