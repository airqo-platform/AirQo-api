const devConfig = {
  DEFAULT_GROUP: process.env.DEV_DEFAULT_GROUP,
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
  REDIS_SERVER: process.env.DEV_REDIS_SERVER,
  REDIS_PORT: process.env.DEV_REDIS_PORT,
};

const prodConfig = {
  DEFAULT_GROUP: process.env.PROD_DEFAULT_GROUP,
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
  REDIS_SERVER: process.env.PROD_REDIS_SERVER,
  REDIS_PORT: process.env.PROD_REDIS_PORT,
};

const stageConfig = {
  DEFAULT_GROUP: process.env.STAGE_DEFAULT_GROUP,
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
  REDIS_SERVER: process.env.STAGE_REDIS_SERVER,
  REDIS_PORT: process.env.STAGE_REDIS_PORT,
};

const defaultConfig = {
  SESSION_SECRET: process.env.SESSION_SECRET,
  ACTION_CODE_SETTINGS: {
    url: process.env.AIRQO_WEBSITE,
    handleCodeInApp: true,
    iOS: {
      bundleId: process.env.MOBILE_APP_PACKAGE_NAME,
    },
    android: {
      packageName: process.env.MOBILE_APP_PACKAGE_NAME,
      installApp: true,
      minimumVersion: "12",
    },
    dynamicLinkDomain: process.env.MOBILE_APP_DYNAMIC_LINK_DOMAIN,
  },
  MOBILE_APP_PACKAGE_NAME: process.env.MOBILE_APP_PACKAGE_NAME,
  AIRQO_WEBSITE: process.env.AIRQO_WEBSITE,
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
  FIREBASE_VERIFICATION_SUCCESS_REDIRECT:
    process.env.FIREBASE_VERIFICATION_SUCCESS_REDIRECT,

  GMAIL_VERIFICATION_FAILURE_REDIRECT:
    process.env.GMAIL_VERIFICATION_FAILURE_REDIRECT,
  GMAIL_VERIFICATION_SUCCESS_REDIRECT:
    process.env.GMAIL_VERIFICATION_SUCCESS_REDIRECT,
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
  CHAMPIONS_FORM: "https://forms.gle/hnf8TzfYWJkdDfX47",
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
  EMAIL_GREETINGS: (name) => {
    return `<tr>
                                <td
                                    style="padding-bottom: 24px; color: #344054; font-size: 16px; font-family: Inter; font-weight: 600; line-height: 24px; word-wrap: break-word;">
                                    Dear ${name},
                                </td>
                            </tr>`;
  },
  EMAIL_HEADER_TEMPLATE: () => {
    return `
<table style="width: 100%; padding-bottom: 24px;">
                            <tr>
                                <td style="display: flex; align-items: center;">
                                    <img src="cid:AirQoEmailLogo" alt="logo" style="height: 48px; width: 71px; margin-right: 10px;">
                                   
                                </td>
                            </tr>

                        </table>
                        `;
  },
  EMAIL_FOOTER_TEMPLATE: (email) => {
    return `
<table style="width: 100%; text-align: center; padding-top: 32px; padding-bottom: 32px;">
                            <tr>
                                <td>
                                    <a href="https://www.facebook.com/AirQo/" target="_blank"><img
                                            src="cid:FacebookLogo" alt="FacebookLogo"
                                            style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                    <a href="https://www.youtube.com/@airqo7875" target="_blank"><img
                                            src="cid:YoutubeLogo" alt="YoutubeLogo"
                                            style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                    <a href="https://www.linkedin.com/company/airqo/" target="_blank"><img
                                            src="cid:LinkedInLogo" alt="LinkedInLogo"
                                            style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                    <a href="https://twitter.com/AirQoProject" target="_blank"><img src="cid:Twitter"
                                            alt="Twitter"
                                            style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                                </td>
                            </tr>
                        </table>

                        <!-- Footer section -->
                        <table style="width: 100%; text-align: center;">
                            <tr>
                                <td>
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">This
                                        email was sent to</span>
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">${email}</span>
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">.
                                        If you'd rather not receive this kind of email, you can </span>
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">unsubscribe</span>
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
                                        or </span>
                                    <span
                                        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">manage
                                        your email preferences.</span><br /><br />
                                    <span
                                        style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">©
                                        2023 AirQo<br /><br />
                                        Makerere University, Software Systems Centre, Block B, Level 3, College of
                                        Computing and
                                        Information Sciences, Plot 56 University Pool Road</span>
                                </td>
                            </tr>
                        </table>
`;
  },

  EMAIL_BODY: (email, content, name) => {
    const footerTemplate = constants.EMAIL_FOOTER_TEMPLATE(email);
    const headerTemplate = constants.EMAIL_HEADER_TEMPLATE();
    let greetings = constants.EMAIL_GREETINGS(name);
    if (!name) {
      greetings = ``;
    }
    return `<!DOCTYPE html>
<html>

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>

    <body style="margin: 0; padding: 0;font-family:Arial, sans-serif;">

        <div style="width: 90%; height: 100%; padding: 32px; background: #F3F6F8;">
            <!-- Email content container with white background -->
            <table style="width: 100%; max-width: 1024px; margin: 0 auto; background: white;">
                <tr>
                    <td style="padding: 24px;">
                        <!-- Logo and title section -->
                         ${headerTemplate}

                        <!-- Email content section -->
                        <table style="width: 100%;">
                           ${greetings}
                            ${content}
                            <tr>
                                <td style=" height: 8px; background: #EBF1FF;"></td>
                            </tr>
                        </table>

                        <!-- Social media section -->
                        ${footerTemplate}
                    </td>
                </tr>
            </table>
        </div>

    </body>

</html>`;
  },
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
      "net_manager.network_roles": 0,
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
          "net_manager.network_roles": 0,
          "net_manager.jobTitle": 0,
          "net_manager.website": 0,
          "net_manager.description": 0,
          "net_manager.category": 0,
          "net_manager.country": 0,
          "net_manager.resetPasswordExpires": 0,
          "net_manager.resetPasswordToken": 0,
          "net_roles.role_status": 0,
          "net_roles.role_code": 0,
          "net_roles.network_id": 0,
          "net_roles.createdAt": 0,
          "net_roles.updatedAt": 0,
          "net_roles.role_permissions": 0,
          "net_roles.__v": 0,
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
    group: { $arrayElemAt: ["$group", 0] },
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
      "role_users.network_roles": 0,
      "role_users.verified": 0,
      "role_users.email": 0,
      "role_users.country": 0,
      "role_users.createdAt": 0,
      "role_users.is_email_verified": 0,
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
      "network.net_manager_username": 0,
      "network.net_manager_firstname": 0,
      "network.net_manager_lastname": 0,
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
    long_organization: 1,
    organization: 1,
    country: 1,
    website: 1,
    category: 1,
    jobTitle: 1,
    rateLimit: 1,
    description: 1,
    profilePicture: 1,
    phoneNumber: 1,
    lol: { $ifNull: [{ $arrayElemAt: ["$lol", 0] }, null] },
    networks: "$networks",
    clients: "$clients",
    groups: "$groups",
    permissions: "$permissions",
    createdAt: {
      $dateToString: {
        format: "%Y-%m-%d %H:%M:%S",
        date: "$_id",
      },
    },
    updatedAt: 1,
    my_networks: "$my_networks",
    my_groups: "$my_groups",
  },
  USERS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "networks.__v": 0,
      "networks.net_status": 0,
      "networks.net_acronym": 0,
      "networks.net_users": 0,
      "networks.net_roles": 0,
      "networks.net_groups": 0,
      "networks.net_description": 0,
      "networks.net_departments": 0,
      "networks.net_permissions": 0,
      "networks.net_email": 0,
      "networks.net_category": 0,
      "networks.net_phoneNumber": 0,
      "networks.net_data_source": 0,
      "networks.net_api_key": 0,
      "networks.net_manager": 0,
      "networks.role.__v": 0,
      "networks.role.createdAt": 0,
      "networks.role.updatedAt": 0,
      "networks.role.role_users": 0,
      "networks.role.network_id": 0,
      "networks.role.role_code": 0,
      "networks.role.role_permissions.__v": 0,
      "networks.role.role_permissions.updatedAt": 0,
      "networks.role.role_permissions.createdAt": 0,
      "networks.role.role_permissions.network_id": 0,
      "networks.role.role_permissions.description": 0,
      "access_tokens.__v": 0,
      "access_tokens.user_id": 0,
      "access_tokens.createdAt": 0,
      "access_tokens.updatedAt": 0,
      "permissions.__v": 0,
      "permissions.network_id": 0,
      "permissions.description": 0,
      "permissions.createdAt": 0,
      "permissions.updatedAt": 0,
      "groups.__v": 0,
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
      "my_networks.net_website": 0,
      "my_networks.net_phoneNumber": 0,
      "my_networks.net_email": 0,
      "my_networks.__v": 0,

      "my_groups.grp_status": 0,
      "my_groups.grp_description": 0,
      "my_groups.grp_tasks": 0,
      "my_groups.grp_manager": 0,
      "my_groups.grp_manager_username": 0,
      "my_groups.grp_manager_firstname": 0,
      "my_groups.grp_manager_lastname": 0,
      "my_groups.createdAt": 0,
      "my_groups.updatedAt": 0,
      "my_groups.__v": 0,

      "lol.role_status": 0,
      "lol.role_permissions": 0,
      "lol.role_code": 0,
      "lol.role_name": 0,
      "lol.createdAt": 0,
      "lol.updatedAt": 0,
      "lol.__v": 0,
      "lol.role_users": 0,
      "clients.__v": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }

    if (category === "networks") {
      projection = Object.assign(
        {
          verified: 0,
          privilege: 0,
          profilePicture: 0,
          phoneNumber: 0,
          updatedAt: 0,
          lol: 0,
          "networks.role": 0,
          clients: 0,
          permissions: 0,
          my_networks: 0,
          my_groups: 0,
        },
        {}
      );
    }

    return projection;
  },

  ACCESS_REQUESTS_INCLUSION_PROJECTION: {
    _id: 1,
    user: { $arrayElemAt: ["$user", 0] },
    requestType: 1,
    targetId: 1,
    status: 1,
    createdAt: {
      $dateToString: {
        format: "%Y-%m-%d %H:%M:%S",
        date: "$_id",
      },
    },
    updatedAt: 1,
  },

  ACCESS_REQUESTS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      nothing: 0,
      "user.notifications": 0,
      "user.emailConfirmed": 0,
      "user.locationCount": 0,
      "user.password": 0,
      "user.privilege": 0,
      "user.organization": 0,
      "user.duration": 0,
      "user.__v": 0,
      "user.phoneNumber": 0,
      "user.profilePicture": 0,
      "user.resetPasswordExpires": 0,
      "user.resetPasswordToken": 0,
      "user.updatedAt": 0,
      "user.role": 0,
      "user.interest": 0,
      "user.org_name": 0,
      "user.accountStatus": 0,
      "user.hasAccess": 0,
      "user.collaborators": 0,
      "user.publisher": 0,
      "user.bus_nature": 0,
      "user.org_department": 0,
      "user.uni_faculty": 0,
      "user.uni_course_yr": 0,
      "user.pref_locations": 0,
      "user.job_title": 0,
      "user.userName": 0,
      "user.product": 0,
      "user.website": 0,
      "user.description": 0,
      "user.networks": 0,
      "user.jobTitle": 0,
      "user.category": 0,
      "user.long_organization": 0,
      "user.groups": 0,
      "user.permissions": 0,
      "user.network_roles": 0,
      "user.verified": 0,
      "user.email": 0,
      "user.country": 0,
      "user.createdAt": 0,
      "user.is_email_verified": 0,
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

  GROUPS_INCLUSION_PROJECTION: {
    _id: 1,
    grp_title: 1,
    grp_status: 1,
    grp_tasks: 1,
    grp_description: 1,
    createdAt: 1,
    numberOfGroupUsers: {
      $cond: {
        if: { $isArray: "$grp_users" },
        then: { $size: "$grp_users" },
        else: "NA",
      },
    },
    grp_users: "$grp_users",
    grp_manager: { $arrayElemAt: ["$grp_manager", 0] },
  },

  GROUPS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "grp_users.__v": 0,
      "grp_users.notifications": 0,
      "grp_users.emailConfirmed": 0,
      "grp_users.groups": 0,
      "grp_users.locationCount": 0,
      "grp_users.group": 0,
      "grp_users.long_network": 0,
      "grp_users.privilege": 0,
      "grp_users.userName": 0,
      "grp_users.password": 0,
      "grp_users.duration": 0,
      "grp_users.createdAt": 0,
      "grp_users.updatedAt": 0,
      "grp_users.updatedAt": 0,
      "grp_users.organization": 0,
      "grp_users.jobTitle": 0,
      "grp_users.website": 0,
      "grp_users.category": 0,
      "grp_users.resetPasswordExpires": 0,
      "grp_users.resetPasswordToken": 0,
      "grp_users.phoneNumber": 0,
      "grp_users.networks": 0,
      "grp_users.role": 0,
      "grp_users.profilePicture": 0,
      "grp_users.network_roles": 0,
      "grp_users.group_roles": 0,
      "grp_manager.__v": 0,
      "grp_manager.notifications": 0,
      "grp_manager.emailConfirmed": 0,
      "grp_manager.networks": 0,
      "grp_manager.locationCount": 0,
      "grp_manager.network": 0,
      "grp_manager.long_network": 0,
      "grp_manager.privilege": 0,
      "grp_manager.userName": 0,
      "grp_manager.password": 0,
      "grp_manager.duration": 0,
      "grp_manager.network_roles": 0,
      "grp_manager.createdAt": 0,
      "grp_manager.updatedAt": 0,
      "grp_manager.groups": 0,
      "grp_manager.role": 0,
      "grp_manager.resetPasswordExpires": 0,
      "grp_manager.resetPasswordToken": 0,
      "grp_manager.phoneNumber": 0,
      "grp_manager.organization": 0,
      "grp_manager.profilePicture": 0,
      "grp_manager.is_email_verified": 0,
      "grp_manager.permissions": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign(
        {},
        {
          grp_tasks: 0,
          grp_description: 0,
          createdAt: 0,
          grp_users: 0,
          grp_manager: 0,
        }
      );
    }
    return projection;
  },

  LOCATION_HISTORIES_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    location: 1,
    latitude: 1,
    longitude: 1,
    reference_site: 1,
    place_id: 1,
    firebase_user_id: 1,
    date_time: 1,
  },

  LOCATION_HISTORIES_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }

    return projection;
  },

  SEARCH_HISTORIES_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    location: 1,
    latitude: 1,
    longitude: 1,
    place_id: 1,
    firebase_user_id: 1,
    date_time: 1,
  },

  SEARCH_HISTORIES_EXCLUSION_PROJECTION: (category) => {
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
    token: 1,
    last_used_at: 1,
    expires: 1,
    name: 1,
    permissions: 1,
    scopes: 1,
    last_ip_address: 1,
    expires_in: 1,
    client: { $arrayElemAt: ["$client", 0] },
    user: { $arrayElemAt: ["$user", 0] },
  },

  TOKENS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "user._id": 0,
      "user.notifications": 0,
      "user.verified": 0,
      "user.networks": 0,
      "user.groups": 0,
      "user.emailConfirmed": 0,
      "user.organization": 0,
      "user.role": 0,
      "user.permissions": 0,
      "user.locationCount": 0,
      "user.password": 0,
      "user.long_organization": 0,
      "user.privilege": 0,
      "user.duration": 0,
      "user.createdAt": 0,
      "user.updatedAt": 0,
      "user.__v": 0,
      "user.resetPasswordExpires": 0,
      "user.resetPasswordToken": 0,
      "user.website": 0,
      "user.category": 0,
      "user.jobTitle": 0,
      "user.profilePicture": 0,
      "user.phoneNumber": 0,
      "user.description": 0,
      "user.country": 0,
      "client.__v": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }

    return projection;
  },

  CLIENTS_INCLUSION_PROJECTION: {
    _id: 1,
    client_id: 1,
    client_secret: 1,
    redirect_uri: 1,
    name: 1,
    description: 1,
    networks: "$networks",
    access_token: { $arrayElemAt: ["$access_token", 0] },
  },
  CLIENTS_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = {
      "networks.__v": 0,
      "networks.net_status": 0,
      "networks.net_acronym": 0,
      "networks.createdAt": 0,
      "networks.updatedAt": 0,
      "networks.net_clients": 0,
      "networks.net_roles": 0,
      "networks.net_groups": 0,
      "networks.net_description": 0,
      "networks.net_departments": 0,
      "networks.net_permissions": 0,
      "networks.net_email": 0,
      "networks.net_category": 0,
      "networks.net_phoneNumber": 0,
      "networks.net_manager": 0,
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
