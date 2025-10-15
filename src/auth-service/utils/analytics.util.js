const constants = require("@config/constants");
const {
  mailer,
  stringify,
  generateFilter,
  addMonthsToProvideDateTime,
  monthsInfront,
  isTimeEmpty,
  getDifferenceInMonths,
  addDays,
} = require("@utils/common");
const { LogModel } = require("@models/log");
const ActivityModel = require("@models/Activity");
const UserModel = require("@models/User");

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-analytics-util`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const httpStatus = require("http-status");

const routesWithService = [
  {
    method: "POST",
    uriIncludes: [
      "api/v2/analytics/data-download",
      "api/v1/analytics/data-download",
    ],
    service: "data-export-download",
    action: "Export Data",
  },
  {
    method: "POST",
    uriIncludes: [
      "api/v1/analytics/data-export",
      "api/v2/analytics/data-export",
    ],
    service: "data-export-scheduling",
    action: "Schedule Data Download",
  },
  /**** Sites */
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "Site Creation",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "View Sites",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "Site Update",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "Site Deletion",
  },

  /**** Devices */
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "Device Deletion",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/soft?"],
    service: "device-registry",
    action: "Device SOFT Deletion",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "Device Update",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/soft?"],
    service: "device-registry",
    action: "Device SOFT Update",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "View Devices",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "Device Creation",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/soft?"],
    service: "device-registry",
    action: "Device SOFT Creation",
  },
  /**** Cohorts */
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "View Cohorts",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Create Cohorts",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Update Cohort",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Delete Cohort",
  },

  /**** Grids */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "View Grids",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Update Grid",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Delete Grid",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Create Grid",
  },

  /**** AirQlouds */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "View AirQlouds",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Creation",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Update",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Deletion",
  },

  /**** Site Activities */

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/activities/maintain"],
    service: "device-maintenance",
    action: "Maintain Device",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/activities/recall"],
    service: "device-recall",
    action: "Recall Device",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/activities/deploy"],
    service: "device-deployment",
    action: "Deploy Device",
  },

  /**** Users */
  {
    method: "POST",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "Create User",
  },
  {
    method: "GET",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "View Users",
  },
  {
    method: "PUT",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "Update User",
  },
  {
    method: "DELETE",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "Delete User",
  },

  /****Incentives*/
  {
    method: "POST",
    uriIncludes: [
      "api/v1/incentives/transactions/accounts/payments",
      "api/v2/incentives/transactions/accounts/payments",
    ],
    service: "incentives",
    action: "Add Money to Organizational Account",
  },
  {
    method: "POST",
    uriIncludes: [
      "api/v1/incentives/transactions/hosts",
      "api/v2/incentives/transactions/hosts",
    ],
    service: "incentives",
    action: "Send Money to Host",
  },

  /**** Calibrate */
  {
    method: "POST",
    uriIncludes: ["/api/v1/calibrate", "/api/v2/calibrate"],
    service: "calibrate",
    action: "calibrate device",
  },

  /**** Locate */
  {
    method: "POST",
    uriIncludes: ["/api/v1/locate", "/api/v2/locate"],
    service: "locate",
    action: "Identify Suitable Device Locations",
  },

  /**** Fault Detection */
  {
    method: "POST",
    uriIncludes: ["/api/v1/predict-faults", "/api/v2/predict-faults"],
    service: "fault-detection",
    action: "Detect Faults",
  },

  /**** Readings... */
  {
    method: "GET",
    uriIncludes: [
      "/api/v2/devices/measurements",
      "/api/v2/devices/events",
      "/api/v2/devices/readings",
    ],
    service: "events-registry",
    action: " Retrieve Measurements",
  },

  /**** Data Proxy */
  {
    method: "GET",
    uriIncludes: ["/api/v2/data"],
    service: "data-mgt",
    action: "Retrieve Data",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/data-proxy"],
    service: "data-proxy",
    action: "Retrieve Data",
  },

  /*****Analytics */
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/sites"],
    service: "analytics",
    action: "Retrieve Sites on Analytics Page",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/historical/daily-averages"],
    service: "analytics",
    action: "Retrieve Daily Averages on Analytics Page",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/exceedances-devices"],
    service: "analytics",
    action: "Retrieve Exceedances on Analytics Page",
  },

  /*****KYA lessons */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Retrieve KYA lessons",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Create KYA lesson",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Update KYA lesson",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Delete KYA lesson",
  },
  /*****KYA Quizzes */
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/kya/quizzes/users"],
    service: "kya",
    action: "Retrieve KYA quizzes",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Create KYA quizzes",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Update KYA quiz",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Delete KYA quiz",
  },

  /*****view */
  {
    method: "GET",
    uriIncludes: ["/api/v2/view/mobile-app/version-info"],
    service: "mobile-version",
    action: "View Mobile App Information",
  },

  /*****Predict */
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/daily-forecast"],
    service: "predict",
    action: "Retrieve Daily Forecasts",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/hourly-forecast"],
    service: "predict",
    action: "Retrieve Hourly Forecasts",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/heatmap"],
    service: "predict",
    action: "Retrieve Heatmap",
  },

  /*****Device Monitoring */
  {
    method: "GET",
    uriIncludes: ["/api/v2/monitor"],
    service: "monitor",
    action: "Retrieve Network Statistics Data",
  },

  {
    method: "GET",
    uriIncludes: ["/api/v2/meta-data"],
    service: "meta-data",
    action: "Retrieve Metadata",
  },

  {
    method: "GET",
    uriIncludes: ["/api/v2/network-uptime"],
    service: "network-uptime",
    action: "Retrieve Network Uptime Data",
  },

  /*************************** USER-CENTRIC ANALYTICS & PRIVACY APIS ***************************/

  /**** Location Privacy Control: Privacy Zones Management */
  {
    method: "POST",
    uriIncludes: ["/api/v2/users/analytics/privacy-zones"],
    service: "privacy-zone-mgt",
    action: "Create Privacy Zone",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/users/analytics/privacy-zones"],
    service: "privacy-zone-mgt",
    action: "Get Privacy Zones",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/users/analytics/privacy-zones"],
    service: "privacy-zone-mgt",
    action: "Update Privacy Zone",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/users/analytics/privacy-zones"],
    service: "privacy-zone-mgt",
    action: "Delete Privacy Zone",
  },

  /**** Location Privacy Control: Location Data Management */
  {
    method: "GET",
    uriIncludes: ["/api/v2/users/analytics/location-data"],
    service: "location-data-mgt",
    action: "Get Location History",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/users/analytics/location-data"],
    service: "location-data-mgt",
    action: "Delete Location Data",
  },

  /**** Location Privacy Control: Data Sharing Control */
  {
    method: "PUT",
    uriIncludes: ["/api/v2/users/analytics/location-data"],
    service: "data-sharing-control",
    action: "Update Data Sharing Consent",
  },

  /**** Location Privacy Control: Location Tracking Preferences */
  {
    method: "GET",
    uriIncludes: ["/api/v2/users/analytics/location-preferences"],
    service: "location-preferences",
    action: "Get Tracking Preferences",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/users/analytics/location-preferences"],
    service: "location-preferences",
    action: "Update Tracking Preferences",
  },

  /**** Behavioral Intervention: Alert Response Management */
  {
    method: "POST",
    uriIncludes: ["/api/v2/users/alert-responses"],
    service: "behavioral-intervention",
    action: "Submit Alert Response",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/users/alert-responses"],
    service: "behavioral-intervention",
    action: "Get User Alert Responses",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/research/behavioral-interventions"],
    service: "behavioral-intervention-research",
    action: "Get Aggregated Behavioral Data",
  },

  /**** Research Consent Management */
  {
    method: "POST",
    uriIncludes: ["/api/v2/research/consent"],
    service: "research-consent",
    action: "Create Research Consent",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/research/consent"],
    service: "research-consent",
    action: "Get Consent Status",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/research/consent"],
    service: "research-consent",
    action: "Update Consent Preferences",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/research/consent"],
    service: "research-consent",
    action: "Withdraw from Study",
  },
];

// Helper functions to calculate additional metrics
function calculateActivityDuration(
  firstActivity,
  lastActivity,
  yearStart,
  yearEnd
) {
  // Ensure we're working with Date objects
  const start = new Date(firstActivity);
  const end = new Date(lastActivity);
  const yearStartDate = new Date(yearStart);
  const yearEndDate = new Date(yearEnd);

  // Use the year boundaries if dates fall outside
  const effectiveStart = start < yearStartDate ? yearStartDate : start;
  const effectiveEnd = end > yearEndDate ? yearEndDate : end;

  // Calculate duration
  const duration = effectiveEnd - effectiveStart;
  const days = Math.floor(duration / (1000 * 60 * 60 * 24));

  // Calculate months more accurately
  const months = Math.floor(
    (effectiveEnd.getFullYear() - effectiveStart.getFullYear()) * 12 +
      (effectiveEnd.getMonth() - effectiveStart.getMonth())
  );

  return {
    totalDays: days,
    totalMonths: months,
    yearStart: yearStartDate,
    yearEnd: yearEndDate,
    actualStart: effectiveStart,
    actualEnd: effectiveEnd,
    description:
      months > 0
        ? `Active for ${months} month${months !== 1 ? "s" : ""}`
        : `Active for ${days} day${days !== 1 ? "s" : ""}`,
  };
}

// Helper function for calculating engagement score
function calculateEngagementScore({
  totalActions,
  uniqueServices,
  uniqueEndpoints,
  activityDays,
}) {
  // Use at least 30 days as denominator
  const actionsPerDay = totalActions / Math.max(activityDays, 30);

  const serviceDiversity =
    uniqueServices / Math.min(routesWithService.length, 20);
  const endpointDiversity = Math.min(uniqueEndpoints / 10, 1);

  return (
    (actionsPerDay * 0.4 + serviceDiversity * 0.3 + endpointDiversity * 0.3) *
    100
  );
}

// Simplified engagement tier calculation
function calculateEngagementTier(score) {
  if (score >= 80) return "Elite User";
  if (score >= 65) return "Super User";
  if (score >= 45) return "High Engagement";
  if (score >= 25) return "Moderate Engagement";
  return "Low Engagement";
}

/**
 * Calculates user engagement metrics and analytics
 * @param {Object} params Engagement calculation parameters
 * @param {number} params.totalActions Total number of API calls/actions
 * @param {Array} params.services List of unique services used
 * @param {Array} params.endpoints List of unique endpoints accessed
 * @param {Date} params.firstActivity Date of first activity
 * @param {Date} params.lastActivity Date of last activity
 * @param {Array} params.dailyStats Array of daily activity statistics
 * @returns {Object} Comprehensive engagement metrics
 */
async function calculateUserEngagementMetrics({
  totalActions = 0,
  services = [],
  endpoints = [],
  firstActivity,
  lastActivity,
  dailyStats = [],
}) {
  const TOTAL_AVAILABLE_SERVICES = constants.AVAILABLE_SERVICES?.length || 20;
  const TOTAL_AVAILABLE_ENDPOINTS = constants.AVAILABLE_ENDPOINTS?.length || 50;

  // Calculate base metrics
  const activityDuration =
    lastActivity && firstActivity
      ? Math.ceil((lastActivity - firstActivity) / (1000 * 60 * 60 * 24))
      : 1;

  const actionsPerDay = totalActions / Math.max(activityDuration, 30);

  const uniqueServices = new Set(services.map((s) => s.name));
  const uniqueEndpoints = new Set(endpoints.map((e) => e.name));

  const serviceDiversity = Math.min(
    uniqueServices.size / TOTAL_AVAILABLE_SERVICES,
    1
  );
  const endpointDiversity = Math.min(
    uniqueEndpoints.size / TOTAL_AVAILABLE_ENDPOINTS,
    1
  );

  // Calculate activity patterns
  const activityPatterns = analyzeActivityPatterns(dailyStats);

  // Calculate service usage patterns
  const serviceUsagePatterns = analyzeServiceUsagePatterns(services);

  // Calculate consistency score
  const consistencyScore = calculateConsistencyScore(
    dailyStats,
    activityDuration
  );

  // Calculate growth trend
  const growthTrend = calculateGrowthTrend(dailyStats);

  // Calculate engagement score with enhanced weights
  const engagementScore = calculateWeightedScore({
    actionsPerDay,
    serviceDiversity,
    endpointDiversity,
    consistencyScore,
    growthTrend,
  });

  return {
    basicMetrics: {
      totalActions,
      activityDuration,
      actionsPerDay,
      uniqueServicesCount: uniqueServices.size,
      uniqueEndpointsCount: uniqueEndpoints.size,
    },
    engagementMetrics: {
      serviceDiversity,
      endpointDiversity,
      consistencyScore,
      growthTrend,
      engagementScore,
    },
    activityPatterns,
    serviceUsagePatterns,
    recommendations: generateRecommendations({
      serviceDiversity,
      endpointDiversity,
      consistencyScore,
      serviceUsagePatterns,
    }),
  };
}

/**
 * Analyzes daily activity patterns
 * @param {Array} dailyStats Array of daily activity records
 * @returns {Object} Activity pattern analysis
 */
function analyzeActivityPatterns(dailyStats) {
  const activeWeekdays = new Set();
  const hourlyDistribution = new Array(24).fill(0);
  const weeklyAverage = [];

  dailyStats.forEach((day) => {
    const date = new Date(day.date);
    activeWeekdays.add(date.getDay());

    // Analyze hourly patterns if available
    if (day.hourlyBreakdown) {
      day.hourlyBreakdown.forEach((count, hour) => {
        hourlyDistribution[hour] += count;
      });
    }

    // Calculate weekly averages
    if (weeklyAverage.length < 12) {
      // Track last 12 weeks
      weeklyAverage.push(day.totalActions);
    }
  });

  return {
    preferredDays: Array.from(activeWeekdays),
    peakHours: findPeakHours(hourlyDistribution),
    weeklyTrend: calculateWeeklyTrend(weeklyAverage),
    consistency: calculateActivityConsistency(dailyStats),
  };
}

/**
 * Analyzes service usage patterns
 * @param {Array} services List of services with usage counts
 * @returns {Object} Service usage analysis
 */
function analyzeServiceUsagePatterns(services) {
  const serviceUsage = services.reduce((acc, service) => {
    acc[service.name] = acc[service.name] || { count: 0, frequency: 0 };
    acc[service.name].count += service.count;
    acc[service.name].frequency++;
    return acc;
  }, {});

  // Calculate primary and secondary services
  const sortedServices = Object.entries(serviceUsage).sort(
    ([, a], [, b]) => b.count - a.count
  );

  return {
    primaryServices: sortedServices.slice(0, 3).map(([name]) => name),
    serviceDistribution: sortedServices.reduce((acc, [name, data]) => {
      acc[name] = (data.count / services.length) * 100;
      return acc;
    }, {}),
    unusedServices: findUnusedServices(services),
  };
}

/**
 * Calculates consistency score based on activity patterns
 * @param {Array} dailyStats Daily activity statistics
 * @param {number} duration Total duration in days
 * @returns {number} Consistency score between 0-1
 */
function calculateConsistencyScore(dailyStats, duration) {
  if (!dailyStats.length) return 0;

  const activeDaysCount = dailyStats.length;
  const activeRatio = activeDaysCount / duration;

  // Calculate variance in daily activity
  const avgActions =
    dailyStats.reduce((sum, day) => sum + day.totalActions, 0) /
    activeDaysCount;
  const variance =
    dailyStats.reduce((sum, day) => {
      return sum + Math.pow(day.totalActions - avgActions, 2);
    }, 0) / activeDaysCount;

  const consistencyFactor = 1 / (1 + Math.sqrt(variance) / avgActions);

  return activeRatio * 0.6 + consistencyFactor * 0.4;
}

/**
 * Calculates growth trend based on activity history
 * @param {Array} dailyStats Daily activity statistics
 * @returns {number} Growth trend indicator between -1 and 1
 */
function calculateGrowthTrend(dailyStats) {
  if (dailyStats.length < 7) return 0;

  const weeklyTotals = [];
  let currentWeek = [];

  dailyStats.forEach((day) => {
    currentWeek.push(day.totalActions);
    if (currentWeek.length === 7) {
      weeklyTotals.push(currentWeek.reduce((a, b) => a + b, 0));
      currentWeek = [];
    }
  });

  if (weeklyTotals.length < 2) return 0;

  const growth =
    weeklyTotals.slice(1).reduce((acc, curr, idx) => {
      return acc + (curr - weeklyTotals[idx]) / weeklyTotals[idx];
    }, 0) /
    (weeklyTotals.length - 1);

  return Math.max(-1, Math.min(1, growth));
}

/**
 * Generates personalized recommendations based on usage patterns
 * @param {Object} params User engagement metrics
 * @returns {Array} List of recommendations
 */
function generateRecommendations({
  serviceDiversity,
  endpointDiversity,
  consistencyScore,
  serviceUsagePatterns,
}) {
  const recommendations = [];

  if (serviceDiversity < 0.3) {
    recommendations.push({
      type: "service_exploration",
      priority: "high",
      message:
        "Consider exploring additional services to enhance your integration",
      suggestedServices: serviceUsagePatterns.unusedServices.slice(0, 3),
    });
  }

  if (endpointDiversity < 0.3) {
    recommendations.push({
      type: "endpoint_utilization",
      priority: "medium",
      message: "Explore additional endpoints within your current services",
    });
  }

  if (consistencyScore < 0.5) {
    recommendations.push({
      type: "consistency",
      priority: "high",
      message: "Consider establishing a more regular usage pattern",
    });
  }

  return recommendations;
}

/**
 * Determines user engagement tier with enhanced criteria
 * @param {Object} params Engagement tier calculation parameters
 * @param {Object} params.engagementMetrics Complete engagement metrics
 * @param {Date} params.lastActivity Date of last activity
 * @returns {Object} Detailed engagement classification
 */
async function determineUserEngagementTier({
  engagementMetrics,
  lastActivity,
}) {
  const { engagementScore, consistencyScore, growthTrend } = engagementMetrics;

  const daysSinceLastActivity = lastActivity
    ? Math.ceil((new Date() - lastActivity) / (1000 * 60 * 60 * 24))
    : Infinity;

  // Define tier criteria
  const tierCriteria = {
    Elite: {
      minScore: 80,
      minConsistency: 0.8,
      minGrowth: 0.1,
    },
    Super: {
      minScore: 65,
      minConsistency: 0.6,
      minGrowth: 0,
    },
    High: {
      minScore: 45,
      minConsistency: 0.4,
      minGrowth: -0.1,
    },
    Moderate: {
      minScore: 25,
      minConsistency: 0.2,
      minGrowth: -0.2,
    },
  };

  // Return inactive status if no activity in last 90 days
  if (daysSinceLastActivity > 90) {
    return {
      tier: "Inactive",
      status: "dormant",
      reactivationPriority: daysSinceLastActivity > 180 ? "high" : "medium",
    };
  }

  // Determine tier based on multiple criteria
  for (const [tier, criteria] of Object.entries(tierCriteria)) {
    if (
      engagementScore >= criteria.minScore &&
      consistencyScore >= criteria.minConsistency &&
      growthTrend >= criteria.minGrowth
    ) {
      return {
        tier: `${tier} User`,
        status: "active",
        metrics: {
          score: engagementScore,
          consistency: consistencyScore,
          growth: growthTrend,
        },
        nextTierProgress: calculateNextTierProgress(
          engagementMetrics,
          tier,
          tierCriteria
        ),
      };
    }
  }

  return {
    tier: "Low Engagement",
    status: "at_risk",
    metrics: {
      score: engagementScore,
      consistency: consistencyScore,
      growth: growthTrend,
    },
    improvementAreas: identifyImprovementAreas(engagementMetrics),
  };
}

/**
 * Calculates progress towards next engagement tier
 * @param {Object} metrics Current engagement metrics
 * @param {string} currentTier Current tier
 * @param {Object} tierCriteria Tier qualification criteria
 * @returns {Object} Progress metrics towards next tier
 */
function calculateNextTierProgress(metrics, currentTier, tierCriteria) {
  const tiers = Object.keys(tierCriteria);
  const currentTierIndex = tiers.indexOf(currentTier);

  if (currentTierIndex === 0) return null; // Already at highest tier

  const nextTier = tiers[currentTierIndex - 1];
  const nextTierCriteria = tierCriteria[nextTier];

  return {
    nextTier,
    scoreProgress: (metrics.engagementScore / nextTierCriteria.minScore) * 100,
    consistencyProgress:
      (metrics.consistencyScore / nextTierCriteria.minConsistency) * 100,
    growthProgress:
      metrics.growthTrend > 0
        ? (metrics.growthTrend / nextTierCriteria.minGrowth) * 100
        : 0,
  };
}

function capitalizeWord(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatServiceName(serviceName) {
  // Handle null, undefined or empty strings
  if (!serviceName) return "";

  // Replace hyphens with spaces and split into words
  return serviceName.split("-").map(capitalizeWord).join(" ");
}

// Get a user's monthly stats for a specific period
const getUserMonthlyStats = async (email, year, month, tenant = "airqo") => {
  const stats = await ActivityModel(tenant).findOne(
    {
      email,
      "monthlyStats.year": year,
      "monthlyStats.month": month,
    },
    {
      "monthlyStats.$": 1,
      overallStats: 1,
    }
  );
  return stats;
};

// Get a user's daily stats for a date range
const getUserDailyStats = async (
  email,
  startDate,
  endDate,
  tenant = "airqo"
) => {
  const stats = await ActivityModel(tenant).findOne(
    {
      email,
      "dailyStats.date": {
        $gte: startDate,
        $lte: endDate,
      },
    },
    {
      dailyStats: {
        $filter: {
          input: "$dailyStats",
          as: "day",
          cond: {
            $and: [
              { $gte: ["$$day.date", startDate] },
              { $lte: ["$$day.date", endDate] },
            ],
          },
        },
      },
    }
  );
  return stats;
};

// Get top users by engagement score for a specific month
const getTopUsers = async (year, month, limit = 10, tenant = "airqo") => {
  const users = await ActivityModel(tenant)
    .find({
      "monthlyStats.year": year,
      "monthlyStats.month": month,
    })
    .sort({ "monthlyStats.$.engagementScore": -1 })
    .limit(limit);
  return users;
};

/**
 * Predicts future engagement trends and potential churn risk
 * @param {Object} params Prediction parameters
 * @param {Array} params.dailyStats Historical daily statistics
 * @param {Array} params.monthlyStats Monthly statistics
 * @param {Object} params.currentMetrics Current engagement metrics
 * @returns {Object} Prediction analysis and risk assessment
 */
async function predictEngagementTrends({
  dailyStats = [],
  monthlyStats = [],
  currentMetrics = {},
}) {
  // Calculate trailing indicators
  const trailingIndicators = calculateTrailingIndicators(dailyStats);

  // Analyze seasonal patterns
  const seasonalPatterns = analyzeSeasonalPatterns(monthlyStats);

  // Predict future engagement
  const predictions = generateEngagementPredictions({
    trailingIndicators,
    seasonalPatterns,
    currentMetrics,
  });

  // Calculate churn risk
  const churnRisk = assessChurnRisk({
    trailingIndicators,
    predictions,
    currentMetrics,
  });

  return {
    shortTermPredictions: predictions.shortTerm,
    longTermPredictions: predictions.longTerm,
    churnRisk,
    seasonalPatterns,
    recommendedActions: generatePreventiveActions(churnRisk),
  };
}

/**
 * Performs cohort analysis for user segments
 * @param {Array} users Array of user activities
 * @param {Object} params Analysis parameters
 * @returns {Object} Cohort analysis results
 */
async function performCohortAnalysis(
  users,
  {
    cohortPeriod = "monthly",
    metrics = ["engagement", "retention", "activity"],
    minCohortSize = 5,
  } = {}
) {
  // Group users into cohorts
  const cohorts = groupIntoCohorts(users, cohortPeriod);

  // Calculate cohort metrics
  const cohortMetrics = calculateCohortMetrics(cohorts, metrics);

  // Analyze cohort patterns
  const patterns = analyzeCohortPatterns(cohortMetrics);

  return {
    cohortMetrics,
    patterns,
    insights: generateCohortInsights(patterns),
    benchmarks: calculateCohortBenchmarks(cohortMetrics),
  };
}

/**
 * Performs competitive benchmarking against platform averages
 * @param {Object} userMetrics Individual user metrics
 * @param {Object} benchmarkData Platform benchmark data
 * @returns {Object} Benchmark comparison results
 */
function performBenchmarkAnalysis(userMetrics, benchmarkData) {
  const comparisons = {};
  const insights = [];

  // Compare key metrics against benchmarks
  Object.entries(userMetrics).forEach(([metric, value]) => {
    if (benchmarkData[metric]) {
      const percentile = calculatePercentile(
        value,
        benchmarkData[metric].distribution
      );
      const comparison = {
        value,
        benchmark: benchmarkData[metric].average,
        percentile,
        difference:
          ((value - benchmarkData[metric].average) /
            benchmarkData[metric].average) *
          100,
      };
      comparisons[metric] = comparison;

      // Generate insights based on significant differences
      if (Math.abs(comparison.difference) > 20) {
        insights.push(generateBenchmarkInsight(metric, comparison));
      }
    }
  });

  return { comparisons, insights };
}

/**
 * Generates engagement health score and detailed diagnostics
 * @param {Object} params Health score parameters
 * @returns {Object} Health score and diagnostics
 */
function calculateEngagementHealth({
  currentMetrics,
  historicalData,
  benchmarks,
  predictions,
}) {
  // Calculate core health indicators
  const indicators = {
    activity: calculateActivityHealth(currentMetrics, historicalData),
    growth: calculateGrowthHealth(currentMetrics, predictions),
    sustainability: calculateSustainabilityHealth(currentMetrics, benchmarks),
    diversity: calculateDiversityHealth(currentMetrics),
  };

  // Generate overall health score
  const healthScore = calculateOverallHealth(indicators);

  // Identify health factors
  const { strengths, weaknesses } = identifyHealthFactors(indicators);

  return {
    healthScore,
    indicators,
    diagnosis: {
      strengths,
      weaknesses,
      prognosis: generateHealthPrognosis(healthScore, predictions),
    },
    recommendations: generateHealthRecommendations(indicators),
  };
}

/**
 * Analyzes user behavior patterns and segments
 * @param {Array} activityData User activity data
 * @returns {Object} Behavior analysis results
 */
function analyzeBehaviorPatterns(activityData) {
  // Identify usage patterns
  const patterns = identifyUsagePatterns(activityData);

  // Segment user behavior
  const segments = segmentUserBehavior(patterns);

  // Analyze feature adoption
  const featureAdoption = analyzeFeatureAdoption(activityData);

  return {
    patterns,
    segments,
    featureAdoption,
    recommendations: generateBehaviorRecommendations(segments),
  };
}

/**
 * Generates detailed activity analytics report
 * @param {Object} params Report parameters
 * @returns {Object} Comprehensive activity report
 */
async function generateActivityReport({
  userId,
  timeframe = "last30days",
  metrics = ["all"],
  includeProjections = true,
}) {
  // Gather all required data
  const activityData = await aggregateActivityData(userId, timeframe);
  const benchmarks = await getBenchmarkData(timeframe);

  // Calculate current metrics
  const currentMetrics = await calculateUserEngagementMetrics(activityData);

  // Generate predictions if requested
  const predictions = includeProjections
    ? await predictEngagementTrends({
        dailyStats: activityData.dailyStats,
        monthlyStats: activityData.monthlyStats,
        currentMetrics,
      })
    : null;

  // Calculate engagement health
  const healthAnalysis = calculateEngagementHealth({
    currentMetrics,
    historicalData: activityData,
    benchmarks,
    predictions,
  });

  // Analyze behavior patterns
  const behaviorAnalysis = analyzeBehaviorPatterns(activityData);

  return {
    summary: {
      userId,
      timeframe,
      healthScore: healthAnalysis.healthScore,
      engagementTier: await determineUserEngagementTier({
        engagementMetrics: currentMetrics,
        lastActivity: activityData.lastActivity,
      }),
    },
    metrics: currentMetrics,
    health: healthAnalysis,
    behavior: behaviorAnalysis,
    predictions: predictions,
    benchmarks: await performBenchmarkAnalysis(currentMetrics, benchmarks),
    recommendations: prioritizeRecommendations([
      ...healthAnalysis.recommendations,
      ...behaviorAnalysis.recommendations,
    ]),
  };
}

/**
 * Analyzes service adoption and usage maturity
 * @param {Object} params Service analysis parameters
 * @returns {Object} Service adoption analysis
 */
function analyzeServiceAdoption({ services, endpoints, historicalUsage }) {
  // Calculate adoption metrics
  const adoptionMetrics = calculateAdoptionMetrics(services, endpoints);

  // Analyze usage maturity
  const maturityAnalysis = assessUsageMaturity(historicalUsage);

  // Identify adoption barriers
  const barriers = identifyAdoptionBarriers(adoptionMetrics, maturityAnalysis);

  return {
    adoptionMetrics,
    maturityLevel: maturityAnalysis.level,
    barriers,
    recommendations: generateAdoptionRecommendations(barriers),
  };
}

// Helper functions implementation

/**
 * Calculates trailing indicators from daily statistics
 * @param {Array} dailyStats Array of daily activity records
 * @returns {Object} Trailing indicators and trends
 */
function calculateTrailingIndicators(dailyStats) {
  // Sort dailyStats by date
  const sortedStats = [...dailyStats].sort(
    (a, b) => new Date(a.date) - new Date(b.date)
  );

  // Calculate trailing windows
  const windows = {
    "7d": sortedStats.slice(-7),
    "30d": sortedStats.slice(-30),
    "90d": sortedStats.slice(-90),
  };

  // Calculate metrics for each window
  const indicators = {};
  Object.entries(windows).forEach(([period, stats]) => {
    const totalActions = stats.reduce((sum, day) => sum + day.totalActions, 0);
    const avgActions = totalActions / stats.length;
    const variance =
      stats.reduce((sum, day) => {
        return sum + Math.pow(day.totalActions - avgActions, 2);
      }, 0) / stats.length;

    indicators[period] = {
      totalActions,
      avgActions,
      variance,
      volatility: Math.sqrt(variance) / avgActions,
      trend: calculateTrend(stats.map((day) => day.totalActions)),
    };
  });

  return {
    indicators,
    momentum: calculateMomentum(indicators),
    stability: assessStability(indicators),
  };
}

/**
 * Analyzes seasonal patterns in monthly statistics
 * @param {Array} monthlyStats Array of monthly statistics
 * @returns {Object} Seasonal patterns and trends
 */
function analyzeSeasonalPatterns(monthlyStats) {
  const patterns = {
    monthly: {},
    quarterly: {},
    yearly: {},
  };

  // Analyze monthly patterns
  for (let month = 0; month < 12; month++) {
    const monthData = monthlyStats.filter(
      (stat) => new Date(stat.date).getMonth() === month
    );
    patterns.monthly[month] = calculateMonthlyPattern(monthData);
  }

  // Analyze quarterly patterns
  for (let quarter = 0; quarter < 4; quarter++) {
    const quarterData = monthlyStats.filter(
      (stat) => Math.floor(new Date(stat.date).getMonth() / 3) === quarter
    );
    patterns.quarterly[quarter] = calculateQuarterlyPattern(quarterData);
  }

  // Calculate year-over-year trends
  patterns.yearly = calculateYearlyPatterns(monthlyStats);

  return {
    patterns,
    seasonalityIndex: calculateSeasonalityIndex(patterns),
    peakPeriods: identifyPeakPeriods(patterns),
    troughPeriods: identifyTroughPeriods(patterns),
  };
}

/**
 * Generates engagement predictions based on historical data
 * @param {Object} params Prediction parameters
 * @returns {Object} Short and long-term predictions
 */
function generateEngagementPredictions({
  trailingIndicators,
  seasonalPatterns,
  currentMetrics,
}) {
  const shortTermPrediction = generateShortTermPrediction({
    trailingIndicators,
    currentMetrics,
  });

  const longTermPrediction = generateLongTermPrediction({
    seasonalPatterns,
    currentMetrics,
  });

  const confidenceScores = calculatePredictionConfidence({
    shortTermPrediction,
    longTermPrediction,
    historicalAccuracy: trailingIndicators,
  });

  return {
    shortTerm: {
      ...shortTermPrediction,
      confidence: confidenceScores.shortTerm,
    },
    longTerm: {
      ...longTermPrediction,
      confidence: confidenceScores.longTerm,
    },
    factors: identifyPredictionFactors({
      trailingIndicators,
      seasonalPatterns,
    }),
  };
}

/**
 * Assesses risk of user churn based on engagement metrics
 * @param {Object} params Risk assessment parameters
 * @returns {Object} Churn risk analysis
 */
function assessChurnRisk({ trailingIndicators, predictions, currentMetrics }) {
  // Calculate risk factors
  const riskFactors = {
    activityDecline: calculateActivityDecline(trailingIndicators),
    engagementDrop: calculateEngagementDrop(currentMetrics),
    predictedChurn: evaluatePredictedChurn(predictions),
  };

  // Calculate risk scores
  const riskScores = {
    immediate: calculateImmediateRisk(riskFactors),
    shortTerm: calculateShortTermRisk(riskFactors),
    longTerm: calculateLongTermRisk(riskFactors),
  };

  return {
    riskLevel: determineRiskLevel(riskScores),
    riskFactors,
    riskScores,
    timeToChurn: estimateTimeToChurn(riskScores, trailingIndicators),
  };
}

/**
 * Generates preventive actions based on churn risk analysis
 * @param {Object} churnRisk Churn risk analysis results
 * @returns {Array} Prioritized preventive actions
 */
function generatePreventiveActions(churnRisk) {
  const actions = [];

  // Generate immediate actions for high-risk users
  if (churnRisk.riskLevel === "high") {
    actions.push(...generateHighRiskActions(churnRisk));
  }

  // Generate proactive actions for medium-risk users
  if (churnRisk.riskLevel === "medium") {
    actions.push(...generateMediumRiskActions(churnRisk));
  }

  // Generate monitoring actions for low-risk users
  if (churnRisk.riskLevel === "low") {
    actions.push(...generateLowRiskActions(churnRisk));
  }

  return prioritizeActions(actions, churnRisk);
}

/**
 * Groups users into cohorts based on specified period
 * @param {Array} users Array of user records
 * @param {string} period Cohort period ('daily', 'weekly', 'monthly')
 * @returns {Object} Grouped cohorts
 */
function groupIntoCohorts(users, period) {
  const cohorts = {};

  users.forEach((user) => {
    const cohortKey = generateCohortKey(user.firstActivity, period);
    cohorts[cohortKey] = cohorts[cohortKey] || [];
    cohorts[cohortKey].push(user);
  });

  return filterValidCohorts(cohorts);
}

/**
 * Calculates metrics for each cohort
 * @param {Object} cohorts Grouped cohort data
 * @param {Array} metrics Metrics to calculate
 * @returns {Object} Cohort metrics
 */
function calculateCohortMetrics(cohorts, metrics) {
  const cohortMetrics = {};

  Object.entries(cohorts).forEach(([cohortKey, users]) => {
    cohortMetrics[cohortKey] = {
      size: users.length,
      metrics: {},
    };

    metrics.forEach((metric) => {
      cohortMetrics[cohortKey].metrics[metric] = calculateMetric(users, metric);
    });
  });

  return cohortMetrics;
}

/**
 * Analyzes patterns across different cohorts
 * @param {Object} cohortMetrics Calculated cohort metrics
 * @returns {Object} Pattern analysis
 */
function analyzeCohortPatterns(cohortMetrics) {
  const patterns = {
    retentionCurves: calculateRetentionCurves(cohortMetrics),
    engagementTrends: analyzeEngagementTrends(cohortMetrics),
    cohortComparisons: compareCohorts(cohortMetrics),
  };

  return {
    patterns,
    significantPatterns: identifySignificantPatterns(patterns),
    anomalies: detectCohortAnomalies(patterns),
  };
}

/**
 * Generates insights from cohort patterns
 * @param {Object} patterns Analyzed cohort patterns
 * @returns {Array} Actionable insights
 */
function generateCohortInsights(patterns) {
  const insights = [];

  // Analyze retention insights
  insights.push(...analyzeRetentionInsights(patterns.retentionCurves));

  // Analyze engagement insights
  insights.push(...analyzeEngagementInsights(patterns.engagementTrends));

  // Analyze comparative insights
  insights.push(...analyzeComparativeInsights(patterns.cohortComparisons));

  return prioritizeInsights(insights);
}

/**
 * Calculates benchmarks across cohorts
 * @param {Object} cohortMetrics Cohort metrics data
 * @returns {Object} Benchmark calculations
 */
function calculateCohortBenchmarks(cohortMetrics) {
  const benchmarks = {
    retention: calculateRetentionBenchmarks(cohortMetrics),
    engagement: calculateEngagementBenchmarks(cohortMetrics),
    growth: calculateGrowthBenchmarks(cohortMetrics),
  };

  return {
    benchmarks,
    trends: analyzeBenchmarkTrends(benchmarks),
    recommendations: generateBenchmarkRecommendations(benchmarks),
  };
}

// Internal helper functions...

function calculateTrend(values) {
  // Simple linear regression
  const n = values.length;
  const indices = Array.from({ length: n }, (_, i) => i);

  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((sum, x, i) => sum + x * values[i], 0);
  const sumXX = indices.reduce((sum, x) => sum + x * x, 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  return slope / (sumY / n); // Normalized slope
}

function calculateMomentum(indicators) {
  const shortTerm = indicators["7d"].trend;
  const mediumTerm = indicators["30d"].trend;
  const longTerm = indicators["90d"].trend;

  return {
    value: shortTerm * 0.5 + mediumTerm * 0.3 + longTerm * 0.2,
    direction: Math.sign(shortTerm),
    strength: Math.abs(shortTerm) / Math.abs(longTerm),
  };
}

function assessStability(indicators) {
  return {
    shortTerm: 1 / (1 + indicators["7d"].volatility),
    mediumTerm: 1 / (1 + indicators["30d"].volatility),
    longTerm: 1 / (1 + indicators["90d"].volatility),
  };
}

const analytics = {
  // User Engagement Functions
  getUserEngagement: async (request, next) => {
    try {
      const { email, tenant } = request.query;
      const user = await ActivityModel(tenant).findOne({ email });

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.NOT_FOUND, {
            message: "No engagement data found for this user",
          })
        );
      }

      const engagementMetrics = await calculateUserEngagementMetrics({
        totalActions: user.overallStats.totalActions,
        services: user.monthlyStats[0].topServices,
        endpoints: user.monthlyStats[0].uniqueEndpoints,
        firstActivity: user.overallStats.firstActivity,
        lastActivity: user.overallStats.lastActivity,
        dailyStats: user.dailyStats,
      });

      return {
        success: true,
        message: "User engagement data retrieved successfully",
        data: engagementMetrics,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getEngagementMetrics: async (request, next) => {
    try {
      const { email, tenant, timeframe = "last30days" } = request.query;
      const user = await ActivityModel(tenant).findOne({ email });

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.NOT_FOUND, {
            message: "No metrics found for this user",
          })
        );
      }

      const metrics = await generateActivityReport({
        userId: user._id,
        timeframe,
        metrics: ["all"],
        includeProjections: true,
      });

      return {
        success: true,
        message: "Engagement metrics retrieved successfully",
        data: metrics,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Activity Analysis Functions
  getActivityReport: async (request, next) => {
    try {
      const { email, tenant, startDate, endDate } = request.query;
      const user = await ActivityModel(tenant).findOne({ email });

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.NOT_FOUND, {
            message: "No activity data found for this user",
          })
        );
      }

      const report = await generateActivityReport({
        userId: user._id,
        timeframe: { startDate, endDate },
        metrics: ["all"],
        includeProjections: true,
      });

      return {
        success: true,
        message: "Activity report generated successfully",
        data: report,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Cohort Analysis Functions
  getCohortAnalysis: async (request, next) => {
    try {
      const { tenant, period = "monthly", metrics = ["all"] } = request.query;

      const cohortAnalysis = await performCohortAnalysis(tenant, {
        cohortPeriod: period,
        metrics,
      });

      return {
        success: true,
        message: "Cohort analysis completed successfully",
        data: cohortAnalysis,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Predictive Analytics Functions
  getPredictiveAnalytics: async (request, next) => {
    try {
      const { email, tenant } = request.query;
      const user = await ActivityModel(tenant).findOne({ email });

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.NOT_FOUND, {
            message: "No data found for predictions",
          })
        );
      }

      const predictions = await predictEngagementTrends({
        dailyStats: user.dailyStats,
        monthlyStats: user.monthlyStats,
        currentMetrics: user.overallStats,
      });

      return {
        success: true,
        message: "Predictive analytics generated successfully",
        data: predictions,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Service Adoption Functions
  getServiceAdoption: async (request, next) => {
    try {
      const { email, tenant } = request.query;
      const user = await ActivityModel(tenant).findOne({ email });

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.NOT_FOUND, {
            message: "No service adoption data found",
          })
        );
      }

      const adoptionAnalysis = analyzeServiceAdoption({
        services: user.monthlyStats[0].topServices,
        endpoints: user.monthlyStats[0].uniqueEndpoints,
        historicalUsage: user.dailyStats,
      });

      return {
        success: true,
        message: "Service adoption analysis completed successfully",
        data: adoptionAnalysis,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Benchmark Functions
  getBenchmarks: async (request, next) => {
    try {
      const { tenant, metrics = ["all"] } = request.query;

      const benchmarks = await calculateCohortBenchmarks({
        tenant,
        metrics,
      });

      return {
        success: true,
        message: "Benchmarks retrieved successfully",
        data: benchmarks,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Top Users Functions
  getTopUsers: async (request, next) => {
    try {
      const { tenant, limit = 10, metric = "engagementScore" } = request.query;

      const topUsers = await ActivityModel(tenant)
        .find({})
        .sort({ [`overallStats.${metric}`]: -1 })
        .limit(parseInt(limit));

      return {
        success: true,
        message: "Top users retrieved successfully",
        data: topUsers,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Aggregated Analytics Functions
  getAggregatedAnalytics: async (request, next) => {
    try {
      const {
        tenant,
        metrics = ["all"],
        timeframe = "last30days",
      } = request.query;

      const aggregatedData = await ActivityModel(tenant).aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            averageEngagement: { $avg: "$overallStats.engagementScore" },
            totalActions: { $sum: "$overallStats.totalActions" },
          },
        },
      ]);

      return {
        success: true,
        message: "Aggregated analytics retrieved successfully",
        data: aggregatedData[0],
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Retention Analysis Functions
  getRetentionAnalysis: async (request, next) => {
    try {
      const { tenant, period = "monthly" } = request.query;

      const cohorts = await analyzeCohorts();
      const cohortMetrics = await analyzeCohortMetrics();
      const retentionAnalysis = await analyzeCohortTrends();

      return {
        success: true,
        message: "Retention analysis completed successfully",
        data: {
          cohorts,
          metrics: cohortMetrics,
          trends: retentionAnalysis,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Health Score Functions
  getEngagementHealth: async (request, next) => {
    try {
      const { email, tenant } = request.query;
      const user = await ActivityModel(tenant).findOne({ email });

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.NOT_FOUND, {
            message: "No health score data found",
          })
        );
      }

      const healthScore = await calculateUserEngagementScore({
        totalActions: user.monthlyStats[0].totalActions,
        services: user.monthlyStats[0].topServices,
        endpoints: user.monthlyStats[0].uniqueEndpoints,
        firstActivity: user.monthlyStats[0].firstActivity,
        lastActivity: user.monthlyStats[0].lastActivity,
      });

      return {
        success: true,
        message: "Health score retrieved successfully",
        data: healthScore,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  // Behavior Pattern Functions
  getBehaviorPatterns: async (request, next) => {
    try {
      const { email, tenant } = request.query;
      const user = await ActivityModel(tenant).findOne({ email });

      if (!user) {
        return next(
          new HttpError("User not found", httpStatus.NOT_FOUND, {
            message: "No behavior pattern data found",
          })
        );
      }

      const patterns = await analyzeSeasonalPatterns(user.monthlyStats);
      const trailingMetrics = calculateTrailingIndicators(user.dailyStats);

      return {
        success: true,
        message: "Behavior patterns analyzed successfully",
        data: {
          seasonalPatterns: patterns,
          trailingIndicators: trailingMetrics,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  enhancedGetUserStats: async (request, next) => {
    try {
      return {
        success: false,
        message: "enhancedGetUserStats temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "enhancedGetUserStats temporarily disabled" },
      };
      const {
        tenant,
        limit = 1000,
        skip = 0,
        startTime,
        endTime,
      } = request.query;

      const filter = {
        ...generateFilter.logs(request, next),
        timestamp: {
          $gte: new Date(startTime),
          $lte: new Date(endTime),
        },
        "meta.service": { $nin: ["unknown", "none", "", null] },
      };

      logger.info(`Applied filter: ${stringify(filter)}`);

      const pipeline = [
        { $match: filter },
        {
          $facet: {
            paginatedResults: [
              {
                $group: {
                  _id: "$meta.email",
                  username: { $first: "$meta.username" },
                  totalCount: { $sum: 1 },
                  uniqueServices: { $addToSet: "$meta.service" },
                  uniqueEndpoints: { $addToSet: "$meta.endpoint" },
                  firstActivity: { $min: "$timestamp" },
                  lastActivity: { $max: "$timestamp" },
                  // Efficient service usage tracking
                  serviceUsage: {
                    $push: {
                      service: "$meta.service",
                      endpoint: "$meta.endpoint",
                    },
                  },
                },
              },
              { $sort: { totalCount: -1 } },
              { $skip: skip },
              { $limit: limit },
            ],
            totalCount: [
              { $group: { _id: "$meta.email" } },
              { $count: "total" },
            ],
          },
        },
      ];

      const [results] = await LogModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      const enrichedStats = results.paginatedResults.map((stat) => {
        // Calculate service statistics
        const serviceStats = stat.serviceUsage.reduce((acc, curr) => {
          const { service } = curr;
          acc[service] = (acc[service] || 0) + 1;
          return acc;
        }, {});

        const topServices = Object.entries(serviceStats)
          .map(([service, count]) => ({
            service: formatServiceName(service),
            count,
          }))
          .sort((a, b) => b.count - a.count);

        const activityDuration = calculateActivityDuration(
          stat.firstActivity,
          stat.lastActivity,
          new Date(startTime),
          new Date(endTime)
        );

        return {
          email: stat._id,
          username: stat.username,
          count: stat.totalCount,
          uniqueServices: stat.uniqueServices,
          uniqueEndpoints: stat.uniqueEndpoints,
          firstActivity: stat.firstActivity,
          lastActivity: stat.lastActivity,
          topServices,
          activityDuration,
          engagementTier: calculateEngagementTier({
            count: stat.totalCount,
            uniqueServices: stat.uniqueServices,
            uniqueEndpoints: stat.uniqueEndpoints,
            activityDuration,
          }),
        };
      });

      return {
        success: true,
        message: "Successfully retrieved user statistics",
        data: enrichedStats,
        total: results.totalCount[0]?.total || 0,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
  validateEnvironmentData: async ({
    tenant,
    year = new Date().getFullYear(),
  } = {}) => {
    try {
      return {
        success: false,
        message: " validateEnvironmentData temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: " validateEnvironmentData temporarily disabled" },
      };
      logger.info(
        `Running data validation for environment: ${constants.ENVIRONMENT}`
      );

      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);

      const pipeline = [
        {
          $match: {
            timestamp: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $facet: {
            monthlyDistribution: [
              {
                $group: {
                  _id: {
                    year: { $year: "$timestamp" },
                    month: { $month: "$timestamp" },
                  },
                  count: { $sum: 1 },
                  uniqueUsers: { $addToSet: "$meta.email" },
                  uniqueEndpoints: { $addToSet: "$meta.endpoint" },
                  uniqueServices: { $addToSet: "$meta.service" },
                },
              },
              { $sort: { "_id.year": 1, "_id.month": 1 } },
            ],
            userSample: [
              {
                $group: {
                  _id: "$meta.email",
                  firstActivity: { $min: "$timestamp" },
                  lastActivity: { $max: "$timestamp" },
                  totalActions: { $sum: 1 },
                },
              },
              { $match: { totalActions: { $gt: 100 } } },
              { $limit: 10 },
            ],
            systemMetrics: [
              {
                $group: {
                  _id: null,
                  totalLogs: { $sum: 1 },
                  avgLogsPerDay: {
                    $avg: {
                      $sum: 1,
                    },
                  },
                  uniqueServices: { $addToSet: "$meta.service" },
                  uniqueEndpoints: { $addToSet: "$meta.endpoint" },
                },
              },
            ],
          },
        },
      ];

      const [results] = await LogModel(tenant)
        .aggregate(pipeline)
        .allowDiskUse(true);

      // Enrich the monthly distribution with percentage changes
      const enrichedDistribution = results.monthlyDistribution.map(
        (month, index, arr) => {
          const prevMonth = index > 0 ? arr[index - 1] : null;
          return {
            year: month._id.year,
            month: month._id.month,
            totalLogs: month.count,
            uniqueUsers: month.uniqueUsers.length,
            uniqueEndpoints: month.uniqueEndpoints.length,
            uniqueServices: month.uniqueServices.length,
            percentageChange: prevMonth
              ? (
                  ((month.count - prevMonth.count) / prevMonth.count) *
                  100
                ).toFixed(2)
              : null,
          };
        }
      );

      return {
        success: true,
        message: "Environment data validation completed",
        data: {
          monthlyDistribution: enrichedDistribution,
          userSample: results.userSample,
          systemMetrics: results.systemMetrics[0],
          timeframe: {
            startDate,
            endDate,
            totalDays: Math.floor(
              (endDate - startDate) / (1000 * 60 * 60 * 24)
            ),
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Error in validateEnvironmentData: ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
        }
      );
    }
  },
  fetchUserStats: async ({
    emails = [],
    year = new Date().getFullYear(),
    tenant = "airqo",
    chunkSize = 5,
    timeWindowDays = 90, // Process data in 90-day windows
  } = {}) => {
    try {
      return {
        success: false,
        message: "fetchUserStats temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "fetchUserStats temporarily disabled" },
      };
      const startDate = new Date(`${year}-01-01`);
      const endDate = new Date(`${year}-12-31`);
      const enrichedStats = [];

      // Process users in chunks to avoid memory overload
      for (let i = 0; i < emails.length; i += chunkSize) {
        const emailChunk = emails.slice(i, i + chunkSize);

        // Break the year into smaller time windows
        const timeWindows = [];
        let currentStart = new Date(startDate);

        while (currentStart < endDate) {
          const windowEnd = new Date(currentStart);
          windowEnd.setDate(windowEnd.getDate() + timeWindowDays);
          const actualEnd = windowEnd > endDate ? endDate : windowEnd;

          timeWindows.push({
            start: new Date(currentStart),
            end: new Date(actualEnd),
          });

          currentStart = new Date(actualEnd);
        }

        // Process each time window for the current user chunk
        const userStatsPromises = timeWindows.map(async (window) => {
          const pipeline = [
            {
              $match: {
                timestamp: {
                  $gte: window.start,
                  $lte: window.end,
                },
                "meta.email": { $in: emailChunk },
                "meta.service": { $nin: ["unknown", "none", "", null] },
              },
            },
            {
              $group: {
                _id: "$meta.email",
                totalCount: { $sum: 1 },
                username: { $first: "$meta.username" },
                firstActivity: { $min: "$timestamp" },
                lastActivity: { $max: "$timestamp" },
                uniqueServices: { $addToSet: "$meta.service" },
                uniqueEndpoints: { $addToSet: "$meta.endpoint" },
                serviceUsage: {
                  $push: {
                    service: "$meta.service",
                  },
                },
              },
            },
          ];

          return LogModel(tenant).aggregate(pipeline).allowDiskUse(true).exec();
        });

        // Wait for all time windows to complete for current user chunk
        const windowResults = await Promise.all(userStatsPromises);

        // Merge results for each user across time windows
        const mergedUserStats = emailChunk.reduce((acc, email) => {
          acc[email] = {
            email,
            totalCount: 0,
            username: "",
            firstActivity: null,
            lastActivity: null,
            uniqueServices: new Set(),
            uniqueEndpoints: new Set(),
            serviceUsage: new Map(),
          };
          return acc;
        }, {});

        // Combine stats from all time windows
        windowResults.flat().forEach((stat) => {
          if (!stat || !stat._id) return;

          const userStats = mergedUserStats[stat._id];
          if (!userStats) return;

          userStats.totalCount += stat.totalCount;
          userStats.username = stat.username;

          if (
            !userStats.firstActivity ||
            stat.firstActivity < userStats.firstActivity
          ) {
            userStats.firstActivity = stat.firstActivity;
          }
          if (
            !userStats.lastActivity ||
            stat.lastActivity > userStats.lastActivity
          ) {
            userStats.lastActivity = stat.lastActivity;
          }

          stat.uniqueServices.forEach((s) => userStats.uniqueServices.add(s));
          stat.uniqueEndpoints.forEach((e) => userStats.uniqueEndpoints.add(e));

          // Update service usage counts
          stat.serviceUsage.forEach((usage) => {
            const current = userStats.serviceUsage.get(usage.service) || 0;
            userStats.serviceUsage.set(usage.service, current + 1);
          });
        });

        // Convert merged stats to final format
        Object.values(mergedUserStats).forEach((stat) => {
          if (stat.totalCount === 0) return; // Skip users with no activity

          const topServices = Array.from(stat.serviceUsage.entries())
            .map(([service, count]) => ({
              service: formatServiceName(service),
              count,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

          const activityDays = Math.floor(
            (stat.lastActivity - stat.firstActivity) / (1000 * 60 * 60 * 24)
          );

          const engagementScore = calculateEngagementScore({
            totalActions: stat.totalCount,
            uniqueServices: stat.uniqueServices.size,
            uniqueEndpoints: stat.uniqueEndpoints.size,
            activityDays: activityDays || 1,
          });

          enrichedStats.push({
            email: stat.email,
            username: stat.username,
            totalActions: stat.totalCount,
            firstActivity: stat.firstActivity,
            lastActivity: stat.lastActivity,
            uniqueServices: Array.from(stat.uniqueServices),
            uniqueEndpoints: Array.from(stat.uniqueEndpoints),
            topServices,
            activityDuration: {
              totalDays: activityDays,
              totalMonths: Math.floor(activityDays / 30),
              description: `Active for ${Math.floor(activityDays / 30)} months`,
            },
            engagementTier: calculateEngagementTier(engagementScore),
          });
        });

        // Add a small delay between chunks to prevent overwhelming the server
        if (i + chunkSize < emails.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return enrichedStats;
    } catch (error) {
      logger.error(`Error in fetchUserStats: ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  sendEmailsInBatches: async (userStats, batchSize = 100) => {
    try {
      return {
        success: false,
        message: "sendEmailsInBatches temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "sendEmailsInBatches temporarily disabled" },
      };
      let emailsSent = 0;
      let lowEngagementCount = 0;

      for (let i = 0; i < userStats.length; i += batchSize) {
        const batch = userStats.slice(i, i + batchSize);
        const emailPromises = batch
          .filter((userStat) => {
            if (userStat.engagementTier === "Low Engagement") {
              lowEngagementCount++;
              return false;
            }
            return true;
          })
          .map((userStat) => {
            const { email, username } = userStat;

            return mailer
              .yearEndEmail({
                email,
                firstName: username.split(" ")[0],
                lastName: username.split(" ")[1] || "",
                userStat,
              })
              .then((response) => {
                if (response && response.success === false) {
                  logger.error(
                    `🐛🐛 Error sending year-end email to ${email}: ${stringify(
                      response
                    )}`
                  );
                } else {
                  emailsSent++;
                }
                return response;
              });
          });

        await Promise.all(emailPromises);
      }

      return {
        success: true,
        message:
          lowEngagementCount > 0
            ? `Sent year-end emails to ${emailsSent} users. Skipped ${lowEngagementCount} users with low engagement.`
            : `Sent year-end emails to ${emailsSent} users`,
      };
    } catch (error) {
      logger.error(`🐛🐛 Error in sendEmailsInBatches: ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  sendYearEndEmails: async (request) => {
    try {
      return {
        success: false,
        message: "sendYearEndEmails temporarily disabled",
        status: httpStatus.NOT_IMPLEMENTED,
        errors: { message: "sendYearEndEmails temporarily disabled" },
      };
      const { body, query } = request;
      const { emails } = body;
      const { tenant } = query;

      const userStats = await analytics.fetchUserStats({ emails, tenant });
      logObject("userStats", userStats);

      if (userStats.length > 0) {
        const result = await analytics.sendEmailsInBatches(userStats);
        return result;
      } else {
        logger.info("No user stats found for the provided emails.");
        return {
          success: false,
          message: "No user stats found for the provided emails",
        };
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  listLogs: async (request, next) => {
    try {
      const { tenant, limit = 1000, skip = 0 } = request.query;
      const filter = generateFilter.logs(request, next);
      const responseFromListLogs = await LogModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      if (responseFromListLogs.success === true) {
        return {
          success: true,
          message: responseFromListLogs.message,
          data: responseFromListLogs.data,
          status: responseFromListLogs.status
            ? responseFromListLogs.status
            : httpStatus.OK,
        };
      } else if (responseFromListLogs.success === false) {
        const errorObject = responseFromListLogs.errors
          ? responseFromListLogs.errors
          : { message: "Internal Server Error" };
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: responseFromListLogs.message,
              ...errorObject,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listActivities: async (request, next) => {
    try {
      const { tenant, limit = 1000, skip = 0 } = request.query;
      const filter = generateFilter.activities(request, next);
      const responseFromListActivities = await ActivityModel(tenant).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      if (responseFromListActivities.success === true) {
        return {
          success: true,
          message: responseFromListActivities.message,
          data: responseFromListActivities.data,
          status: responseFromListActivities.status
            ? responseFromListActivities.status
            : httpStatus.OK,
        };
      } else if (responseFromListActivities.success === false) {
        const errorObject = responseFromListActivities.errors
          ? responseFromListActivities.errors
          : { message: "Internal Server Error" };
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: responseFromListActivities.message,
              ...errorObject,
            }
          )
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listStatistics: async (tenant, next) => {
    try {
      const responseFromListStatistics = await UserModel(tenant).listStatistics(
        tenant
      );
      return responseFromListStatistics;
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getUserStats: async (request, next) => {
    try {
      const { tenant, limit, skip } = request.query;
      const l = Number.parseInt(limit, 10);
      const s = Number.parseInt(skip, 10);
      // limit: [1,100], skip: [0, +inf)
      const _limit = Number.isInteger(l) ? Math.max(1, Math.min(l, 100)) : 50;
      const _skip = Number.isInteger(s) ? Math.max(0, s) : 0;

      const filter = generateFilter.logs(request, next);

      const pipeline = [
        { $match: filter },
        {
          $group: {
            _id: { email: "$meta.email", endpoint: "$meta.endpoint" },
            service: { $first: "$meta.service" },
            username: { $first: "$meta.username" },
            count: { $sum: 1 },
          },
        },
        {
          $project: {
            _id: 0,
            email: "$_id.email",
            endpoint: "$_id.endpoint",
            count: 1,
            service: "$service",
            username: "$username",
          },
        },
        { $sort: { count: -1 } },
        {
          $facet: {
            paginatedResults: [{ $skip: _skip }, { $limit: _limit }],
            totalCount: [{ $count: "count" }],
          },
        },
      ];

      const [results] = await LogModel(tenant).aggregate(pipeline);
      const paginatedResults = results.paginatedResults || [];
      const totalCount = results.totalCount[0]
        ? results.totalCount[0].count
        : 0;

      return {
        success: true,
        message: "Successfully retrieved the user statistics",
        data: paginatedResults,
        meta: {
          total: totalCount,
          limit: _limit,
          skip: _skip,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = analytics;
