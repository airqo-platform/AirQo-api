const devConfig = {
  DEFAULT_NETWORK: process.env.DEVELOPMENT_DEFAULT_NETWORK,
  MONGO_URI: process.env.MONGO_DEV_URI,
  DB_NAME: process.env.MONGO_DEV,
  PWD_RESET: `${process.env.PLATFORM_DEV_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_DEV_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_DEV_BASE_URL,
  ENVIRONMENT: "DEVELOPMENT ENVIRONMENT",
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_DEV
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_DEV.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_DEV,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_DEV,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_DEV,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_DEV,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_DEV,
  DEFAULT_ROLE: process.env.DEFAULT_ROLE_DEV,
};

const prodConfig = {
  DEFAULT_NETWORK: process.env.PRODUCTION_DEFAULT_NETWORK,
  MONGO_URI: process.env.MONGO_PROD_URI,
  DB_NAME: process.env.MONGO_PROD,
  PWD_RESET: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_PRODUCTION_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_PRODUCTION_BASE_URL,
  ENVIRONMENT: "PRODUCTION ENVIRONMENT",
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_PROD
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_PROD.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_PROD,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_PROD,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_PROD,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_PROD,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_PROD,
  DEFAULT_ROLE: process.env.DEFAULT_ROLE_PROD,
};

const stageConfig = {
  DEFAULT_NETWORK: process.env.STAGING_DEFAULT_NETWORK,
  MONGO_URI: process.env.MONGO_STAGE_URI,
  DB_NAME: process.env.MONGO_STAGE,
  PWD_RESET: `${process.env.PLATFORM_STAGING_BASE_URL}/reset`,
  LOGIN_PAGE: `${process.env.PLATFORM_STAGING_BASE_URL}/login`,
  FORGOT_PAGE: `${process.env.PLATFORM_STAGING_BASE_URL}/forgot`,
  PLATFORM_BASE_URL: process.env.PLATFORM_STAGING_BASE_URL,
  ENVIRONMENT: "STAGING ENVIRONMENT",
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_STAGE,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_STAGE,
  KAFKA_RAW_MEASUREMENTS_TOPICS:
    process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_STAGE,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_STAGE,
  DEFAULT_ROLE: process.env.DEFAULT_ROLE_STAGE,
};

const defaultConfig = {
  FIREBASE_API_KEY: process.env.FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN: process.env.FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_AUTHORIZATION_URL: process.env.FIREBASE_AUTHORIZATION_URL,
  FIREBASE_TYPE: process.env.FIREBASE_TYPE,
  FIREBASE_PRIVATE_KEY_ID: process.env.FIREBASE_PRIVATE_KEY_ID,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  FIREBASE_CLIENT_ID: process.env.FIREBASE_CLIENT_ID,
  FIREBASE_AUTH_URI: process.env.FIREBASE_AUTH_URI,
  FIREBASE_TOKEN_URI: process.env.FIREBASE_TOKEN_URI,
  FIREBASE_AUTH_PROVIDER_X509_CERT_URL:
    process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  FIREBASE_CLIENT_X509_CERT_URL: process.env.FIREBASE_CLIENT_X509_CERT_URL,
  FIREBASE_UNIVERSE_DOMAIN: process.env.FIREBASE_UNIVERSE_DOMAIN,

  GMAIL_VERIFICATION_FAILURE_REDIRECT:
    process.env.GMAIL_VERIFICATION_FAILURE_REDIRECT,
  GMAIL_VERIFICATION_SUCCESS_REDIRECT:
    process.env.GMAIL_VERIFICATION_SUCCESS_REDIRECT,
  FIREBASE_VERIFICATION_SUCCESS_REDIRECT:
    process.env.FIREBASE_VERIFICATION_SUCCESS_REDIRECT,
  SUPER_ADMIN_PERMISSIONS: process.env.SUPER_ADMIN_PERMISSIONS
    ? process.env.SUPER_ADMIN_PERMISSIONS.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  TENANTS: process.env.TENANTS
    ? process.env.TENANTS.split(",").filter((value) => value.trim() !== "")
    : [],
  NETWORKS: process.env.NETWORKS
    ? process.env.NETWORKS.split(",").filter((value) => value.trim() !== "")
    : [],
  UNIQUE_CONSUMER_GROUP: process.env.UNIQUE_CONSUMER_GROUP,
  UNIQUE_PRODUCER_GROUP: process.env.UNIQUE_PRODUCER_GROUP,
  NEW_MOBILE_APP_USER_TOPIC: process.env.NEW_MOBILE_APP_USER_TOPIC,
  DEFAULT_TENANT: process.env.DEFAULT_TENANT,
  CLIENT_ID_LENGTH: 26,
  CLIENT_SECRET_LENGTH: 31,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  MOBILE_APP_USERS_TOPIC: process.env.MOBILE_APP_USERS_TOPIC,
  TOKEN_LENGTH: 16,
  EMAIL_VERIFICATION_HOURS: 1,
  EMAIL_VERIFICATION_MIN: 0,
  EMAIL_VERIFICATION_SEC: 0,
  TWITTER_ACCOUNT: "https://twitter.com/AirQoProject",
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL,
  SLACK_USERNAME: process.env.SLACK_USERNAME,
  PRODUCTS_DEV_EMAIL: process.env.PRODUCTS_DEV_EMAIL,
  FIREBASE_COLLECTION_USERS: process.env.FIREBASE_COLLECTION_USERS,
  FIREBASE_COLLECTION_KYA: process.env.FIREBASE_COLLECTION_KYA,
  FIREBASE_COLLECTION_ANALYTICS: process.env.FIREBASE_COLLECTION_ANALYTICS,
  FIREBASE_COLLECTION_NOTIFICATIONS:
    process.env.FIREBASE_COLLECTION_NOTIFICATIONS,
  FIREBASE_COLLECTION_FAVORITE_PLACES:
    process.env.FIREBASE_COLLECTION_FAVORITE_PLACES,
  EMAIL_NAME: "AirQo Data Team",
  DEFAULT_LIMIT: process.env.DEFAULT_LIMIT,
  PORT: process.env.PORT || 3000,
  CLIENT_ORIGIN: process.env.AIRQO_WEBSITE,
  BCRYPT_SALT_ROUNDS: 12,
  JWT_SECRET: process.env.JWT_SECRET,
  EMAIL: process.env.MAIL_USER,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  REQUEST_ACCESS_EMAILS: process.env.REQUEST_ACCESS_EMAILS,
  COMMS_EMAILS: process.env.COMMS_EMAILS,
  POLICY_EMAILS: process.env.POLICY_EMAILS,
  CHAMPIONS_EMAILS: process.env.CHAMPIONS_EMAILS,
  RESEARCHERS_EMAILS: process.env.RESEARCHERS_EMAILS,
  DEVELOPERS_EMAILS: process.env.DEVELOPERS_EMAILS,
  PARTNERS_EMAILS: process.env.PARTNERS_EMAILS,
  YOUTUBE_CHANNEL: process.env.AIRQO_YOUTUBE,
  ACCOUNT_UPDATED: "The AirQo Platform account has successfully been updated",
  RANDOM_PASSWORD_CONFIGURATION: (length) => {
    return {
      length: length,
      numbers: true,
      uppercase: true,
      lowercase: true,
      strict: true,
      excludeSimilarCharacters: true,
    };
  },
  SALT_ROUNDS: 10,
  KICKBOX_API_KEY: process.env.KICKBOX_API_KEY,
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
  MAILCHIMP_API_KEY: process.env.MAILCHIMP_API_KEY,
  MAILCHIMP_SERVER_PREFIX: process.env.MAILCHIMP_SERVER_PREFIX,
  MAILCHIMP_LIST_ID: process.env.MAILCHIMP_LIST_ID,
  NETWORKS_INCLUSION_PROJECTION: {
    _id: 1,
    net_email: 1,
    net_website: 1,
    net_category: 1,
    net_status: 1,
    net_phoneNumber: 1,
    net_name: 1,
    net_description: 1,
    net_acronym: 1,
    net_data_source: 1,
    net_api_key: 1,
    createdAt: {
      $dateToString: {
        format: "%Y-%m-%d %H:%M:%S",
        date: "$_id",
      },
    },
    net_manager: { $arrayElemAt: ["$net_manager", 0] },
    net_users: "$net_users",
    net_permissions: "$net_permissions",
    net_roles: "$net_roles",
    net_groups: "$net_groups",
    net_departments: "$net_departments",
  },
  NETWORKS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "net_users.__v": 0,
      "net_users.notifications": 0,
      "net_users.emailConfirmed": 0,
      "net_users.networks": 0,
      "net_users.locationCount": 0,
      "net_users.network": 0,
      "net_users.long_network": 0,
      "net_users.privilege": 0,
      "net_users.password": 0,
      "net_users.duration": 0,
      "net_users.updatedAt": 0,
      "net_users.organization": 0,
      "net_users.phoneNumber": 0,
      "net_users.profilePicture": 0,
      "net_users.resetPasswordExpires": 0,
      "net_users.resetPasswordToken": 0,
      "net_users.verified": 0,
      "net_users.groups": 0,
      "net_users.permissions": 0,
      "net_users.long_organization": 0,
      "net_manager.__v": 0,
      "net_manager.notifications": 0,
      "net_manager.emailConfirmed": 0,
      "net_manager.networks": 0,
      "net_manager.locationCount": 0,
      "net_manager.network": 0,
      "net_manager.long_network": 0,
      "net_manager.privilege": 0,
      "net_manager.userName": 0,
      "net_manager.password": 0,
      "net_manager.duration": 0,
      "net_manager.createdAt": 0,
      "net_manager.updatedAt": 0,
      "net_manager.groups": 0,
      "net_manager.role": 0,
      "net_manager.resetPasswordExpires": 0,
      "net_manager.resetPasswordToken": 0,
      "net_manager.phoneNumber": 0,
      "net_manager.organization": 0,
      "net_manager.profilePicture": 0,
      "net_manager.is_email_verified": 0,
      "net_manager.permissions": 0,
      "net_permissions.__v": 0,
      "net_permissions.createdAt": 0,
      "net_permissions.updatedAt": 0,
      "net_roles.__v": 0,
      "net_roles.createdAt": 0,
      "net_roles.updatedAt": 0,
      "net_roles.role_permissions": 0,
      "net_roles.role_code": 0,
      "net_roles.network_id": 0,
      "net_roles.role_status": 0,
      "net_groups.__v": 0,
      "net_groups.createdAt": 0,
      "net_groups.updatedAt": 0,
      "net_departments.__v": 0,
      "net_departments.createdAt": 0,
      "net_departments.updatedAt": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign(
        {},
        {
          net_status: 0,
          net_email: 0,
          net_phoneNumber: 0,
          net_category: 0,
          net_description: 0,
          net_website: 0,
          net_acronym: 0,
          createdAt: 0,
          net_users: 0,
          net_permissions: 0,
          net_roles: 0,
          net_groups: 0,
          net_departments: 0,
          net_data_source: 0,
          net_api_key: 0,
          "net_manager.notifications": 0,
          "net_manager.emailConfirmed": 0,
          "net_manager.locationCount": 0,
          "net_manager.email": 0,
          "net_manager.firstName": 0,
          "net_manager.lastName": 0,
          "net_manager.userName": 0,
          "net_manager.password": 0,
          "net_manager.privilege": 0,
          "net_manager.organization": 0,
          "net_manager.duration": 0,
          "net_manager.__v": 0,
          "net_manager.phoneNumber": 0,
          "net_manager.profilePicture": 0,
          "net_manager.is_email_verified": 0,
          "net_manager.role": 0,
          "net_manager.updatedAt": 0,
          "net_manager.networks": 0,
        }
      );
    }

    return projection;
  },
  ROLES_INCLUSION_PROJECTION: {
    role_name: 1,
    role_description: 1,
    role_status: 1,
    role_code: 1,
    network_id: 1,
    role_permissions: 1,
    role_users: 1,
    network: { $arrayElemAt: ["$network", 0] },
    createdAt: 1,
    updatedAt: 1,
  },
  ROLES_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "role_users.notifications": 0,
      "role_users.emailConfirmed": 0,
      "role_users.locationCount": 0,
      "role_users.password": 0,
      "role_users.privilege": 0,
      "role_users.organization": 0,
      "role_users.duration": 0,
      "role_users.__v": 0,
      "role_users.phoneNumber": 0,
      "role_users.profilePicture": 0,
      "role_users.resetPasswordExpires": 0,
      "role_users.resetPasswordToken": 0,
      "role_users.updatedAt": 0,
      "role_users.role": 0,
      "role_users.interest": 0,
      "role_users.org_name": 0,
      "role_users.accountStatus": 0,
      "role_users.hasAccess": 0,
      "role_users.collaborators": 0,
      "role_users.publisher": 0,
      "role_users.bus_nature": 0,
      "role_users.org_department": 0,
      "role_users.uni_faculty": 0,
      "role_users.uni_course_yr": 0,
      "role_users.pref_locations": 0,
      "role_users.job_title": 0,
      "role_users.userName": 0,
      "role_users.product": 0,
      "role_users.website": 0,
      "role_users.description": 0,
      "role_users.networks": 0,
      "role_users.jobTitle": 0,
      "role_users.category": 0,
      "role_users.long_organization": 0,
      "role_users.groups": 0,
      "role_users.permissions": 0,
      network_id: 0,
      "network.__v": 0,
      "network.net_status": 0,
      "network.net_children": 0,
      "network.net_users": 0,
      "network.net_departments": 0,
      "network.net_permissions": 0,
      "network.net_roles": 0,
      "network.net_groups": 0,
      "network.net_email": 0,
      "network.net_phoneNumber": 0,
      "network.net_data_source": 0,
      "network.net_api_key": 0,
      "network.net_category": 0,
      "network.createdAt": 0,
      "network.updatedAt": 0,
      "network.net_acronym": 0,
      "network.net_manager": 0,
      "role_permissions.description": 0,
      "role_permissions.createdAt": 0,
      "role_permissions.updatedAt": 0,
      "role_permissions.__v": 0,
      "role_permissions.network_id": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign(
        {},
        {
          role_description: 0,
          role_code: 0,
          network_id: 0,
          "role_permissions.description": 0,
          "role_permissions.createdAt": 0,
          "role_permissions.updatedAt": 0,
          "role_permissions.__v": 0,
          "role_permissions.network_id": 0,
          role_users: 0,
          network: 0,
          createdAt: 0,
          updatedAt: 0,
        }
      );
    }

    return projection;
  },

  USERS_INCLUSION_PROJECTION: {
    _id: 1,
    firstName: 1,
    lastName: 1,
    userName: 1,
    email: 1,
    verified: 1,
    country: 1,
    privilege: 1,
    website: 1,
    category: 1,
    jobTitle: 1,
    description: 1,
    profilePicture: 1,
    phoneNumber: 1,
    role: 1,
    networks: "$networks",
    access_tokens: "$access_tokens",
    permissions: "$permissions",
    createdAt: {
      $dateToString: {
        format: "%Y-%m-%d %H:%M:%S",
        date: "$_id",
      },
    },
    updatedAt: 1,
    my_networks: "$my_networks",
  },
  USERS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "networks.__v": 0,
      "networks.net_status": 0,
      "networks.net_acronym": 0,
      "networks.createdAt": 0,
      "networks.updatedAt": 0,
      "networks.net_users": 0,
      "networks.net_roles": 0,
      "networks.net_groups": 0,
      "networks.net_description": 0,
      "networks.net_departments": 0,
      "networks.net_permissions": 0,
      "networks.net_email": 0,
      "networks.net_category": 0,
      "networks.net_phoneNumber": 0,
      "network.net_data_source": 0,
      "network.net_api_key": 0,
      "networks.net_manager": 0,
      "access_tokens.__v": 0,
      "access_tokens.user_id": 0,
      "access_tokens.createdAt": 0,
      "access_tokens.updatedAt": 0,
      "permissions.__v": 0,
      "permissions._id": 0,
      "permissions.createdAt": 0,
      "permissions.updatedAt": 0,
      "role.__v": 0,
      "role.createdAt": 0,
      "role.updatedAt": 0,
      "role.role_users": 0,
      "role.network_id": 0,
      "role.role_code": 0,
      "role.role_permissions.__v": 0,
      "role.role_permissions.updatedAt": 0,
      "role.role_permissions.createdAt": 0,
      "role.role_permissions.network_id": 0,
      "role.role_permissions.description": 0,
      "groups.__v": 0,
      "groups._id": 0,
      "groups.createdAt": 0,
      "groups.updatedAt": 0,
      "my_networks.net_status": 0,
      "my_networks.net_children": 0,
      "my_networks.net_users": 0,
      "my_networks.net_departments": 0,
      "my_networks.net_permissions": 0,
      "my_networks.net_roles": 0,
      "my_networks.net_groups": 0,
      "my_networks.net_category": 0,
      "my_networks.net_description": 0,
      "my_networks.net_acronym": 0,
      "my_networks.net_manager": 0,
      "my_networks.net_manager_username": 0,
      "my_networks.net_manager_firstname": 0,
      "my_networks.net_manager_lastname": 0,
      "my_networks.createdAt": 0,
      "my_networks.updatedAt": 0,
      "my_networks.__v": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }

    return projection;
  },

  CANDIDATES_INCLUSION_PROJECTION: {
    _id: 1,
    firstName: 1,
    lastName: 1,
    email: 1,
    description: 1,
    category: 1,
    long_organization: 1,
    jobTitle: 1,
    website: 1,
    status: 1,
    createdAt: {
      $dateToString: {
        format: "%Y-%m-%d %H:%M:%S",
        date: "$_id",
      },
    },
    updatedAt: 1,
    country: 1,
    existing_user: { $arrayElemAt: ["$user", 0] },
    network: { $arrayElemAt: ["$network", 0] },
  },

  CANDIDATES_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "existing_user.locationCount": 0,
      "existing_user.privilege": 0,
      "existing_user.website": 0,
      "existing_user.organization": 0,
      "existing_user.long_organization": 0,
      "existing_user.category": 0,
      "existing_user.jobTitle": 0,
      "existing_user.profilePicture": 0,
      "existing_user. phoneNumber": 0,
      "existing_user.description": 0,
      "existing_user.createdAt": 0,
      "existing_user.updatedAt": 0,
      "existing_user.notifications": 0,
      "existing_user.emailConfirmed": 0,
      "existing_user.password": 0,
      "existing_user.__v": 0,
      "existing_user.duration": 0,
      "existing_user.verified": 0,
      "existing_user.networks": 0,
      "existing_user.groups": 0,
      "existing_user.role": 0,
      "existing_user.permissions": 0,
      "existing_user.userName": 0,
      "existing_user.country": 0,
      network: 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }

    return projection;
  },

  FAVORITES_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    location: 1,
    latitude: 1,
    longitude: 1,
    reference_site: 1,
    place_id: 1,
    firebase_user_id: 1,
  },

  FAVORITES_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }

    return projection;
  },

  TOKENS_INCLUSION_PROJECTION: {
    _id: 1,
    user_id: 1,
    name: 1,
    token: 1,
    network_id: 1,
    last_used_at: 1,
    expires: 1,
    last_ip_address: 1,
    user: { $arrayElemAt: ["$users", 0] },
  },

  TOKENS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "user._id": 0,
      "user.notifications": 0,
      "user.verified": 0,
      "user.networks": 0,
      "user.groups": 0,
      "user.roles": 0,
      "user.permissions": 0,
      "user.locationCount": 0,
      "user.userName": 0,
      "user.password": 0,
      "user.long_organization": 0,
      "user.privilege": 0,
      "user.duration": 0,
      "user.createdAt": 0,
      "user.updatedAt": 0,
      "user.__v": 0,
      "user.resetPasswordExpires": 0,
      "user.resetPasswordToken": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }

    return projection;
  },
};

function envConfig(env) {
  switch (env) {
    case "development":
      return devConfig;
    case "staging":
      return stageConfig;
    default:
      return prodConfig;
  }
}

module.exports = {
  ...defaultConfig,
  ...envConfig(process.env.NODE_ENV),
};
