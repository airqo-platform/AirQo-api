const cron = require("node-cron");
const UserModel = require("@models/User");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/dashboard-analytics-job script`
);
const { stringify } = require("@utils/common");
const DashboardAnalyticsModel = require("@models/DashboardAnalytics");

const calculateAndCacheAnalytics = async () => {
  try {
    const tenant = constants.DEFAULT_TENANT || "airqo";
    logger.info(
      `Starting dashboard analytics calculation for tenant: ${tenant}`
    );

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const startOfTwoMonthsAgo = new Date(
      twoMonthsAgo.getFullYear(),
      twoMonthsAgo.getMonth(),
      1
    );
    const endOfTwoMonthsAgo = new Date(
      twoMonthsAgo.getFullYear(),
      twoMonthsAgo.getMonth() + 1,
      0
    );

    const aggregationPipeline = [
      {
        $facet: {
          totalUsers: [{ $count: "count" }],
          dailyActiveUsers: [
            { $match: { lastLogin: { $gte: twentyFourHoursAgo } } },
            { $count: "count" },
          ],
          dailyActiveUsersTwoMonthsAgo: [
            {
              $match: {
                lastLogin: {
                  $gte: startOfTwoMonthsAgo,
                  $lte: endOfTwoMonthsAgo,
                },
              },
            },
            { $count: "count" },
          ],
          featureAdoption: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                withInterests: {
                  $sum: {
                    $cond: [
                      { $gt: [{ $size: { $ifNull: ["$interests", []] } }, 0] },
                      1,
                      0,
                    ],
                  },
                },
              },
            },
          ],
          userContribution: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                withProfilePicture: {
                  $sum: {
                    $cond: [{ $ifNull: ["$profilePicture", false] }, 1, 0],
                  },
                },
                withDescription: {
                  $sum: {
                    $cond: [{ $ifNull: ["$description", false] }, 1, 0],
                  },
                },
              },
            },
          ],
          sessionDurationProxy: [
            {
              $group: {
                _id: null,
                averageLoginCount: { $avg: "$loginCount" },
              },
            },
          ],
          userSegments: [
            { $unwind: "$interests" },
            {
              $group: {
                _id: "$interests",
                count: { $sum: 1 },
                averageLoginCount: { $avg: "$loginCount" },
              },
            },
            { $sort: { count: -1 } },
          ],
          behavioralInsights: [
            {
              $group: {
                _id: null,
                usersWithProfilePic: {
                  $sum: { $cond: ["$profilePicture", 1, 0] },
                },
              },
            },
          ],
        },
      },
    ];

    const results = await UserModel(tenant).aggregate(aggregationPipeline);
    const analytics = results[0];

    const totalUsers = analytics.totalUsers[0]?.count || 0;
    const dau = analytics.dailyActiveUsers[0]?.count || 0;
    const dauTwoMonthsAgo =
      analytics.dailyActiveUsersTwoMonthsAgo[0]?.count || 1; // Avoid division by zero
    const featureAdoption = analytics.featureAdoption[0] || {};
    const userContribution = analytics.userContribution[0] || {};
    const sessionProxy = analytics.sessionDurationProxy[0] || {};
    const userSegments = analytics.userSegments || [];
    const behavioralInsights = analytics.behavioralInsights[0] || {};

    const response = {
      userSatisfaction: 8.5, // Placeholder
      dailyActiveUsers: dau,
      dailyActiveUsersChange: ((dau - dauTwoMonthsAgo) / dauTwoMonthsAgo) * 100,
      featureAdoptionRate:
        totalUsers > 0 ? (featureAdoption.withInterests / totalUsers) * 100 : 0,
      // Placeholder for feature adoption change, as historical interest data isn't tracked
      featureAdoptionRateChange: 5.5,
      extendedUserSessionDuration: sessionProxy.averageLoginCount || 0,
      increasedUserDataContribution:
        totalUsers > 0
          ? ((userContribution.withProfilePicture +
              userContribution.withDescription) /
              (totalUsers * 2)) *
            100
          : 0,
      stakeholderDecisionMaking: 75, // Placeholder
      userSegments: userSegments.map((segment) => ({
        segment: segment._id,
        userCount: segment.count,
        engagementScore: segment.averageLoginCount, // Using login count as proxy
        trends: "Stable", // Placeholder for trend analysis
        recommendations: `Target ${segment._id} with specific content.`, // Placeholder
      })),
      behavioralInsights: {
        usersWithProfilePic: behavioralInsights.usersWithProfilePic || 0,
        profilePicAdoptionRate:
          totalUsers > 0
            ? (behavioralInsights.usersWithProfilePic / totalUsers) * 100
            : 0,
      },
      lastUpdated: new Date().toISOString(),
    };

    await DashboardAnalyticsModel(tenant).findOneOrCreate(tenant, response);

    logger.info(
      `Successfully calculated and cached dashboard analytics for tenant: ${tenant}`
    );
  } catch (error) {
    logger.error(
      `Error in calculateAndCacheAnalytics job: ${stringify(error)}`
    );
  }
};

cron.schedule("0 */6 * * *", calculateAndCacheAnalytics, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
