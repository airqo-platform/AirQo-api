const mongoose = require("mongoose");

const dbProjections = {
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
  NETWORKS_EXCLUSION_PROJECTION: function (category) {
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
      "net_users.analyticsVersion": 0,
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
          "net_manager.lastLogin": 0,
          "net_manager.isActive": 0,
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
  ROLES_EXCLUSION_PROJECTION: function (category) {
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
      "role_users.analyticsVersion": 0,
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
    lastLogin: 1,
    isActive: 1,
    userName: 1,
    email: 1,
    verified: 1,
    analyticsVersion: 1,
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
    networks: {
      $cond: {
        if: {
          $and: [
            { $ne: ["$network_role", []] }, // Check if network_role is not empty
            {
              $in: ["airqo", "$networks.net_name"], // Check if user belongs to airqo network
            },
          ],
        },
        then: {
          $concatArrays: [
            [
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$networks",
                      as: "network",
                      cond: { $eq: ["$$network.net_name", "airqo"] },
                    },
                  },
                  0,
                ],
              },
            ],
            {
              $filter: {
                input: "$networks",
                as: "network",
                cond: { $ne: ["$$network.net_name", "airqo"] },
              },
            },
          ],
        },
        else: "$networks",
      },
    },
    // networks: {
    //   $cond: {
    //     if: { $eq: ["$network_role", []] }, // Check if network_role is empty
    //     then: [], // Represent "networks" as an empty array for users with empty network_role
    //     else: "$networks", // Include the "networks" field for users with non-empty network_role
    //   },
    // },
    clients: "$clients",
    groups: {
      $cond: {
        if: {
          $and: [
            { $ne: ["$group_role", []] }, // Check if group_role is not empty
            {
              $in: ["airqo", "$groups.grp_title"], // Check if user belongs to airqo group
            },
          ],
        },
        then: {
          $concatArrays: [
            [
              {
                $arrayElemAt: [
                  {
                    $filter: {
                      input: "$groups",
                      as: "group",
                      cond: { $eq: ["$$group.grp_title", "airqo"] },
                    },
                  },
                  0,
                ],
              },
            ],
            {
              $filter: {
                input: "$groups",
                as: "group",
                cond: { $ne: ["$$group.grp_title", "airqo"] },
              },
            },
          ],
        },
        else: "$groups",
      },
    },
    // groups: {
    //   $cond: {
    //     if: { $eq: ["$group_role", []] }, // Check if group_role is empty
    //     then: [], // Represent "groups" as an empty array  for users with empty group_role
    //     else: "$groups", // Include the "groups" field for users with non-empty group_role
    //   },
    // },
    clients: "$clients",
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
    firebase_uid: 1,
  },
  USERS_EXCLUSION_PROJECTION: function (category) {
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

      "groups.__v": 0,

      "access_tokens.__v": 0,
      "access_tokens.user_id": 0,
      "access_tokens.createdAt": 0,
      "access_tokens.updatedAt": 0,
      "permissions.__v": 0,
      "permissions.network_id": 0,
      "permissions.description": 0,
      "permissions.createdAt": 0,
      "permissions.updatedAt": 0,

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
          analyticsVersion: 0,
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
    user_id: 1,
    email: 1,
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
    user: { $arrayElemAt: ["$user", 0] },
  },

  ACCESS_REQUESTS_EXCLUSION_PROJECTION: function (category) {
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
      "user.category": 0,
      "user.long_organization": 0,
      "user.groups": 0,
      "user.permissions": 0,
      "user.network_roles": 0,
      "user.group_roles": 0,
      "user.verified": 0,
      "users.analyticsVersion": 0,
      "user.email": 0,
      "user.country": 0,
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

  CANDIDATES_EXCLUSION_PROJECTION: function (category) {
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
      "existing_user.analyticsVersion": 0,
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

  FAVORITES_EXCLUSION_PROJECTION: function (category) {
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
    grp_website: 1,
    grp_industry: 1,
    grp_country: 1,
    grp_timezone: 1,
    grp_image: 1,
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

  GROUPS_EXCLUSION_PROJECTION: function (category) {
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
      "grp_users.long_organization": 0,
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
      "grp_manager.group_roles": 0,
      "grp_manager.network_roles": 0,
      "grp_manager.long_organization": 0,
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

  LOCATION_HISTORIES_EXCLUSION_PROJECTION: function (category) {
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

  SEARCH_HISTORIES_EXCLUSION_PROJECTION: function (category) {
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

  TOKENS_EXCLUSION_PROJECTION: function (category) {
    const initialProjection = {
      "user._id": 0,
      "user.notifications": 0,
      "user.verified": 0,
      "user.analyticsVersion": 0,
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

  IPS_INCLUSION_PROJECTION: {
    _id: 1,
    ip: 1,
    emails: 1,
    tokens: 1,
    token_names: 1,
    endpoints: 1,
    ipCounts: 1,
    createdAt: 1,
    updatedAt: 1,
  },
  IPS_EXCLUSION_PROJECTION: function (category) {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }

    return projection;
  },

  IP_RANGES_INCLUSION_PROJECTION: {
    _id: 1,
    range: 1,
  },
  IP_RANGES_EXCLUSION_PROJECTION: function (category) {
    const initialProjection = { nothing: 0 };
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
    ip_address: 1,
    name: 1,
    description: 1,
    networks: "$networks",
    access_token: { $arrayElemAt: ["$access_token", 0] },
  },
  CLIENTS_EXCLUSION_PROJECTION: function (category) {
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
module.exports = dbProjections;
