const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

/**
 * ProjectionFactory - A factory pattern implementation for handling database projections
 */
class ProjectionFactory {
  /**
   * Constructor initializes the base projection data
   */
  constructor() {
    // Initialize all base projections
    this.baseProjections = {
      // GRIDS
      grids: {
        inclusion: {
          _id: 1,
          name: 1,
          long_name: 1,
          flag_url: 1,
          description: 1,
          grid_tags: 1,
          visibility: 1,
          admin_level: 1,
          grid_codes: 1,
          centers: 1,
          shape: 1,
          createdAt: 1,
          network: 1,
          groups: 1,
          sites: {
            $map: {
              input: "$sites",
              as: "site",
              in: {
                _id: "$$site._id",
                name: "$$site.name",
                generated_name: "$$site.generated_name",
                formatted_name: "$$site.formatted_name",
                latitude: "$$site.latitude",
                longitude: "$$site.longitude",
                approximate_latitude: "$$site.approximate_latitude",
                approximate_longitude: "$$site.approximate_longitude",
                country: "$$site.country",
                region: "$$site.region",
                district: "$$site.district",
                county: "$$site.county",
                sub_county: "$$site.sub_county",
                parish: "$$site.parish",
                city: "$$site.city",
                search_name: "$$site.search_name",
                location_name: "$$site.location_name",
              },
            },
          },
          numberOfSites: {
            $cond: {
              if: { $isArray: "$sites" },
              then: { $size: { $ifNull: ["$sites._id", []] } },
              else: "NA",
            },
          },
        },
        exclusion: {
          "mobileDevices.readKey": 0,
          "mobileDevices.writeKey": 0,
          "mobileDevices.ISP": 0,
          "mobileDevices.phoneNumber": 0,
          "mobileDevices.device_manufacturer": 0,
          "mobileDevices.product_name": 0,
          "mobileDevices.visibility": 0,
          "mobileDevices.description": 0,
          "mobileDevices.isPrimaryInLocation": 0,
          "mobileDevices.isUsedForCollocation": 0,
          "mobileDevices.nextMaintenance": 0,
          "mobileDevices.deployment_date": 0,
          "mobileDevices.recall_date": 0,
          "mobileDevices.maintenance_date": 0,
          "mobileDevices.device_codes": 0,
          "mobileDevices.previous_sites": 0,
          "mobileDevices.host_id": 0,
          "mobileDevices.owner_id": 0,
          "mobileDevices.claim_status": 0,
          "mobileDevices.claimed_at": 0,
          "mobileDevices.claim_token": 0,
          "mobileDevices.assigned_organization_id": 0,
          "mobileDevices.assigned_organization": 0,
          "mobileDevices.organization_assigned_at": 0,
          "mobileDevices.updatedAt": 0,
          "mobileDevices.__v": 0,
        },
      },

      kyaAnswers: {
        inclusion: {
          _id: 1,
          title: 1,
          content: 1,
          kya_question_id: {
            $arrayElemAt: ["$kyaquestion._id", 0],
          },
          kya_question_title: {
            $arrayElemAt: ["$kyaquestion.title", 0],
          },
        },
        exclusion: { nothing: 0 },
      },

      kyaQuizProgress: {
        inclusion: {
          user_id: 1,
          quiz_id: 1,
          active_question: 1,
          status: 1,
          _id: 1,
        },
        exclusion: { nothing: 0 },
      },

      // KYA LESSONS PROGRESS
      kyaLessonsProgress: {
        inclusion: {
          user_id: 1,
          lesson_id: 1,
          active_task: 1,
          status: 1,
          completed: 1,
          _id: 1,
        },
        exclusion: { nothing: 0 },
      },

      //KYA LESSONS
      kyaLessons: {
        inclusion: {
          _id: 1,
          title: 1,
          completion_message: 1,
          image: 1,
          tasks: 1,
          active_task: { $arrayElemAt: ["$kya_user_progress.active_task", 0] },
          status: { $arrayElemAt: ["$kya_user_progress.status", 0] },
        },
        exclusion: { nothing: 0 },
      },

      // SITES - Enhanced with activities
      sites: {
        inclusion: {
          _id: 1,
          name: 1,
          latitude: 1,
          longitude: 1,
          grids: 1,
          approximate_latitude: 1,
          approximate_longitude: 1,
          approximate_distance_in_km: 1,
          bearing_in_radians: 1,
          formatted_name: 1,
          description: 1,
          site_tags: 1,
          site_codes: 1,
          search_name: 1,
          location_name: 1,
          lat_long: 1,
          country: 1,
          network: 1,
          groups: 1,
          data_provider: 1,
          district: 1,
          sub_county: 1,
          parish: 1,
          region: 1,
          village: 1,
          city: 1,
          street: 1,
          generated_name: 1,
          county: 1,
          altitude: 1,
          greenness: 1,
          landform_270: 1,
          landform_90: 1,
          aspect: 1,
          status: 1,
          images: 1,
          share_links: 1,
          distance_to_nearest_road: 1,
          distance_to_nearest_primary_road: 1,
          distance_to_nearest_secondary_road: 1,
          distance_to_nearest_tertiary_road: 1,
          distance_to_nearest_unclassified_road: 1,
          distance_to_nearest_residential_road: 1,
          bearing_to_kampala_center: 1,
          distance_to_kampala_center: 1,
          bearing_to_capital_city_center: 1,
          distance_to_capital_city_center: 1,
          createdAt: 1,
          nearest_tahmo_station: 1,
          devices: "$devices",
          airqlouds: "$airqlouds",
          weather_stations: 1,
          onlineStatusAccuracy: 1,
          site_category: 1,
          lastActive: 1,
          isOnline: 1,
          activities: "$activities",
          latest_deployment_activity: {
            $cond: [
              { $isArray: "$latest_deployment_activity" },
              { $arrayElemAt: ["$latest_deployment_activity", 0] },
              "$latest_deployment_activity",
            ],
          },
          latest_maintenance_activity: {
            $cond: [
              { $isArray: "$latest_maintenance_activity" },
              { $arrayElemAt: ["$latest_maintenance_activity", 0] },
              "$latest_maintenance_activity",
            ],
          },
          latest_recall_activity: {
            $cond: [
              { $isArray: "$latest_recall_activity" },
              { $arrayElemAt: ["$latest_recall_activity", 0] },
              "$latest_recall_activity",
            ],
          },
          site_creation_activity: {
            $cond: [
              { $isArray: "$site_creation_activity" },
              { $arrayElemAt: ["$site_creation_activity", 0] },
              "$site_creation_activity",
            ],
          },
          total_activities: {
            $cond: [{ $isArray: "$activities" }, { $size: "$activities" }, 0],
          },
        },
        exclusion: {
          "airqlouds.location": 0,
          "airqlouds.airqloud_tags": 0,
          "airqlouds.long_name": 0,
          "airqlouds.updatedAt": 0,
          "airqlouds.sites": 0,
          "airqlouds.__v": 0,
          "devices.height": 0,
          "devices.__v": 0,
          "devices.phoneNumber": 0,
          "devices.mountType": 0,
          "devices.powerType": 0,
          "devices.generation_version": 0,
          "devices.generation_count": 0,
          "devices.pictures": 0,
          "devices.tags": 0,
          "devices.description": 0,
          "devices.isUsedForCollocation": 0,
          "devices.updatedAt": 0,
          "devices.locationName": 0,
          "devices.siteName": 0,
          "devices.site_id": 0,
          "devices.isRetired": 0,
          "devices.long_name": 0,
          "devices.nextMaintenance": 0,
          "devices.readKey": 0,
          "devices.writeKey": 0,
          "devices.deployment_date": 0,
          "devices.recall_date": 0,
          "devices.maintenance_date": 0,
          "devices.product_name": 0,
          "devices.owner": 0,
          "devices.device_manufacturer": 0,
          "devices.channelID": 0,
          "devices.alias": 0,
          "grids.network_id": 0,
          "grids.geoHash": 0,
          "grids.center_point": 0,
          "grids.long_name": 0,
          "grids.description": 0,
          "grids.grid_tags": 0,
          "grids.grid_codes": 0,
          "grids.shape": 0,
          "grids.network": 0,
          "grids.centers": 0,
          "grids.createdAt": 0,
          "grids.updatedAt": 0,
          "grids.__v": 0,
          "activities.user_id": 0,
          "activities.host_id": 0,
          "activities.network": 0,
          "activities.groups": 0,
          "activities.activity_codes": 0,
          "activities.updatedAt": 0,
          "activities.__v": 0,
          "activities.firstName": 0,
          "activities.lastName": 0,
          "activities.email": 0,
          "activities.userName": 0,
          "device.onlineStatusAccuracy": 0,
          "device.activities_cache_updated_at": 0,
          "device.cached_activities_by_type": 0,
          "device.cached_device_activity_summary": 0,
          "device.cached_latest_activities_by_type": 0,
          "device.cached_latest_deployment_activity": 0,
          "device.cached_latest_maintenance_activity": 0,
          "device.cached_latest_recall_activity": 0,
          "device.cached_total_activities": 0,
          "latest_deployment_activity.firstName": 0,
          "latest_deployment_activity.lastName": 0,
          "latest_deployment_activity.email": 0,
          "latest_deployment_activity.userName": 0,
          "latest_maintenance_activity.firstName": 0,
          "latest_maintenance_activity.lastName": 0,
          "latest_maintenance_activity.email": 0,
          "latest_maintenance_activity.userName": 0,
          "device.onlineStatusAccuracy": 0,
          "device.activities_cache_updated_at": 0,
          "device.cached_activities_by_type": 0,
          "device.cached_device_activity_summary": 0,
          "device.cached_latest_activities_by_type": 0,
          "device.cached_latest_deployment_activity": 0,
          "device.cached_latest_maintenance_activity": 0,
          "device.cached_latest_recall_activity": 0,
          "device.cached_total_activities": 0,
          "latest_recall_activity.firstName": 0,
          "latest_recall_activity.lastName": 0,
          "latest_recall_activity.email": 0,
          "latest_recall_activity.userName": 0,
          "site_creation_activity.firstName": 0,
          "site_creation_activity.lastName": 0,
          "site_creation_activity.email": 0,
          "site_creation_activity.userName": 0,
          "site.weather_stations": 0,
          "site.site_category": 0,
          "site.onlineStatusAccuracy": 0,
          "site.activities_cache_updated_at": 0,
          "site.cached_activities_by_type": 0,
          "site.cached_device_activity_summary": 0,
          "site.cached_latest_activities_by_type": 0,
          "site.cached_latest_deployment_activity": 0,
          "site.cached_total_activities": 0,
        },
      },

      // DEVICES - Enhanced with activities
      devices: {
        inclusion: {
          _id: 1,
          name: 1,
          alias: 1,
          long_name: 1,
          latitude: 1,
          longitude: 1,
          approximate_distance_in_km: 1,
          bearing_in_radians: 1,
          createdAt: 1,
          ISP: 1,
          phoneNumber: 1,
          visibility: 1,
          description: 1,
          isPrimaryInLocation: 1,
          nextMaintenance: 1,
          deployment_date: 1,
          name_id: 1,
          recall_date: 1,
          maintenance_date: 1,
          device_number: 1,
          powerType: 1,
          mountType: 1,
          isActive: 1,
          writeKey: 1,
          readKey: 1,
          access_code: 1,
          device_codes: 1,
          height: 1,
          mobility: 1,
          status: 1,
          network: 1,
          groups: 1,
          api_code: 1,
          serial_number: 1,
          authRequired: 1,
          category: 1,
          cohorts: 1,
          grids: 1,
          lastActive: 1,
          isOnline: 1,
          rawOnlineStatus: 1,
          lastRawData: 1,
          onlineStatusAccuracy: 1,
          previous_sites: 1,
          site: {
            $cond: [
              { $isArray: "$site" },
              { $arrayElemAt: ["$site", 0] },
              "$site",
            ],
          },
          host: {
            $cond: [
              { $isArray: "$host" },
              { $arrayElemAt: ["$host", 0] },
              "$host",
            ],
          },
          activities: "$activities",
          latest_deployment_activity: {
            $cond: [
              { $isArray: "$latest_deployment_activity" },
              { $arrayElemAt: ["$latest_deployment_activity", 0] },
              "$latest_deployment_activity",
            ],
          },
          latest_maintenance_activity: {
            $cond: [
              { $isArray: "$latest_maintenance_activity" },
              { $arrayElemAt: ["$latest_maintenance_activity", 0] },
              "$latest_maintenance_activity",
            ],
          },
          latest_recall_activity: {
            $cond: [
              { $isArray: "$latest_recall_activity" },
              { $arrayElemAt: ["$latest_recall_activity", 0] },
              "$latest_recall_activity",
            ],
          },
          total_activities: {
            $cond: [{ $isArray: "$activities" }, { $size: "$activities" }, 0],
          },
          assigned_grid: {
            $cond: [
              { $isArray: "$assigned_grid" },
              { $arrayElemAt: ["$assigned_grid", 0] },
              "$assigned_grid",
            ],
          },
        },
        exclusion: {
          "site.lat_long": 0,
          "site.country": 0,
          "site.district": 0,
          "site.sub_county": 0,
          "site.parish": 0,
          "site.county": 0,
          "site.altitude": 0,
          "site.greenness": 0,
          "site.landform_90": 0,
          "site.landform_270": 0,
          "site.aspect": 0,
          "site.distance_to_nearest_road": 0,
          "site.distance_to_nearest_primary_road": 0,
          "site.distance_to_nearest_secondary_road": 0,
          "site.distance_to_nearest_tertiary_road": 0,
          "site.distance_to_nearest_unclassified_road": 0,
          "site.distance_to_nearest_residential_road": 0,
          "site.bearing_to_kampala_center": 0,
          "site.distance_to_kampala_center": 0,
          "site.bearing_to_capital_city_center": 0,
          "site.distance_to_capital_city_center": 0,
          "site.generated_name": 0,
          "site.updatedAt": 0,
          "site.city": 0,
          "site.formatted_name": 0,
          "site.geometry": 0,
          "site.google_place_id": 0,
          "site.region": 0,
          "site.site_tags": 0,
          "site.street": 0,
          "site.town": 0,
          "site.nearest_tahmo_station": 0,
          "site.__v": 0,
          "site.images": 0,
          "site.airqlouds": 0,
          "site.site_codes": 0,
          "site.land_use": 0,
          "site.latitude": 0,
          "site.longitude": 0,
          "site.approximate_latitude": 0,
          "site.approximate_longitude": 0,
          "site.bearing_in_radians": 0,
          "site.approximate_distance_in_km": 0,
          "site.description": 0,
          "site.network": 0,
          "site.weather_stations": 0,
          "site.onlineStatusAccuracy": 0,
          "site.activities_cache_updated_at": 0,
          "site.cached_activities_by_type": 0,
          "site.cached_device_activity_summary": 0,
          "site.cached_latest_activities_by_type": 0,
          "site.cached_latest_deployment_activity": 0,
          "site.cached_latest_maintenance_activity": 0,
          "site.cached_latest_recall_activity": 0,
          "site.cached_total_activities": 0,
          "site.createdAt": 0,
          "previous_sites.lat_long": 0,
          "previous_sites.country": 0,
          "previous_sites.district": 0,
          "previous_sites.sub_county": 0,
          "previous_sites.parish": 0,
          "previous_sites.county": 0,
          "previous_sites.altitude": 0,
          "previous_sites.greenness": 0,
          "previous_sites.landform_90": 0,
          "previous_sites.landform_270": 0,
          "previous_sites.aspect": 0,
          "previous_sites.distance_to_nearest_road": 0,
          "previous_sites.distance_to_nearest_primary_road": 0,
          "previous_sites.distance_to_nearest_secondary_road": 0,
          "previous_sites.distance_to_nearest_tertiary_road": 0,
          "previous_sites.distance_to_nearest_unclassified_road": 0,
          "previous_sites.distance_to_nearest_residential_road": 0,
          "previous_sites.bearing_to_kampala_center": 0,
          "previous_sites.distance_to_kampala_center": 0,
          "previous_sites.bearing_to_capital_city_center": 0,
          "previous_sites.distance_to_capital_city_center": 0,
          "previous_sites.generated_name": 0,
          "previous_sites.updatedAt": 0,
          "previous_sites.city": 0,
          "previous_sites.formatted_name": 0,
          "previous_sites.geometry": 0,
          "previous_sites.google_place_id": 0,
          "previous_sites.region": 0,
          "previous_sites.previous_sites_tags": 0,
          "previous_sites.street": 0,
          "previous_sites.town": 0,
          "previous_sites.nearest_tahmo_station": 0,
          "previous_sites.__v": 0,
          "previous_sites.weather_stations": 0,
          "previous_sites.latitude": 0,
          "previous_sites.longitude": 0,
          "previous_sites.images": 0,
          "previous_sites.airqlouds": 0,
          "previous_sites.site_codes": 0,
          "previous_sites.site_tags": 0,
          "previous_sites.land_use": 0,
          "previous_sites.approximate_latitude": 0,
          "previous_sites.approximate_longitude": 0,
          "previous_sites.bearing_in_radians": 0,
          "previous_sites.approximate_distance_in_km": 0,
          "previous_sites.description": 0,
          "previous_sites.network": 0,
          "previous_sites.createdAt": 0,
          "previous_sites.onlineStatusAccuracy": 0,
          "previous_sites.activities_cache_updated_at": 0,
          "previous_sites.cached_activities_by_type": 0,
          "previous_sites.cached_device_activity_summary": 0,
          "previous_sites.cached_latest_activities_by_type": 0,
          "previous_sites.cached_latest_deployment_activity": 0,
          "previous_sites.cached_latest_maintenance_activity": 0,
          "previous_sites.cached_latest_recall_activity": 0,
          "previous_sites.cached_total_activities": 0,
          "cohorts.network_id": 0,
          "cohorts.description": 0,
          "cohorts.cohort_tags": 0,
          "cohorts.cohort_codes": 0,
          "cohorts.visibility": 0,
          "cohorts.network": 0,
          "cohorts.createdAt": 0,
          "cohorts.updatedAt": 0,
          "cohorts.__v": 0,
          "grids.shape": 0,
          "grids.grid_tags": 0,
          "grids.grid_codes": 0,
          "grids.centers": 0,
          "grids.sites": 0,
          "grids.createdAt": 0,
          "grids.updatedAt": 0,
          "grids.__v": 0,
          "grids.network": 0,
          "assigned_grid.shape": 0,
          "assigned_grid.grid_tags": 0,
          "assigned_grid.grid_codes": 0,
          "assigned_grid.centers": 0,
          "assigned_grid.sites": 0,
          "assigned_grid.createdAt": 0,
          "assigned_grid.updatedAt": 0,
          "assigned_grid.__v": 0,
          "assigned_grid.network": 0,
          "assigned_grid.visibility": 0,
          "assigned_grid.description": 0,
          "activities.user_id": 0,
          "activities.host_id": 0,
          "activities.network": 0,
          "activities.groups": 0,
          "activities.activity_codes": 0,
          "activities.updatedAt": 0,
          "activities.__v": 0,
          "activities.firstName": 0,
          "activities.lastName": 0,
          "activities.email": 0,
          "activities.userName": 0,
          "latest_deployment_activity.firstName": 0,
          "latest_deployment_activity.lastName": 0,
          "latest_deployment_activity.email": 0,
          "latest_deployment_activity.userName": 0,
          "latest_maintenance_activity.firstName": 0,
          "latest_maintenance_activity.lastName": 0,
          "latest_maintenance_activity.email": 0,
          "latest_maintenance_activity.userName": 0,
          "latest_recall_activity.firstName": 0,
          "latest_recall_activity.lastName": 0,
          "latest_recall_activity.email": 0,
          "latest_recall_activity.userName": 0,
        },
      },

      cohorts: {
        inclusion: {
          network: 1,
          name: 1,
          description: 1,
          cohort_tags: 1,
          groups: 1,
          createdAt: 1,
          visibility: 1,
          cohort_codes: 1,
          devices: {
            $map: {
              input: "$devices",
              as: "device",
              in: {
                _id: "$$device._id",
                name: "$$device.name",
                long_name: "$$device.long_name",
                description: "$$device.description",
                device_number: "$$device.device_number",
                isActive: "$$device.isActive",
                isOnline: "$$device.isOnline",
                lastActive: "$$device.lastActive",
                status: "$$device.status",
                network: "$$device.network",
                createdAt: "$$device.createdAt",
              },
            },
          },
          numberOfDevices: {
            $cond: {
              if: { $isArray: "$devices" },
              then: { $size: { $ifNull: ["$devices._id", []] } },
              else: "NA",
            },
          },
        },
        exclusion: {
          nothing: 0,
        },
      },

      airqlouds: {
        inclusion: {
          _id: 1,
          name: 1,
          long_name: 1,
          admin_level: 1,
          location: 1,
          airqloud_codes: 1,
          numberOfSites: {
            $cond: {
              if: { $isArray: "$sites" },
              then: { $size: "$sites" },
              else: "NA",
            },
          },
          description: 1,
          airqloud_tags: 1,
          isCustom: 1,
          network: 1,
          groups: 1,
          metadata: 1,
          center_point: 1,
          sites: "$sites",
        },
        exclusion: {
          // Base exclusions for airqlouds
          "sites.altitude": 0,
          "sites.greenness": 0,
          "sites.landform_90": 0,
          "sites.landform_270": 0,
          "sites.aspect": 0,
          "sites.distance_to_nearest_road": 0,
          "sites.distance_to_nearest_primary_road": 0,
          "sites.distance_to_nearest_secondary_road": 0,
          "sites.distance_to_nearest_tertiary_road": 0,
          "sites.distance_to_nearest_unclassified_road": 0,
          "sites.distance_to_nearest_residential_road": 0,
          "sites.bearing_to_kampala_center": 0,
          "sites.distance_to_kampala_center": 0,
          "sites.bearing_to_capital_city_center": 0,
          "sites.distance_to_capital_city_center": 0,
          "sites.updatedAt": 0,
          "sites.nearest_tahmo_station": 0,
          "sites.formatted_name": 0,
          "sites.geometry": 0,
          "sites.google_place_id": 0,
          "sites.site_tags": 0,
          "sites.street": 0,
          "sites.town": 0,
          "sites.village": 0,
          "sites.airqlouds": 0,
          "sites.description": 0,
          "sites.__v": 0,
          "sites.airqloud_id": 0,
          "sites.onlineStatusAccuracy": 0,
          "sites.activities_cache_updated_at": 0,
          "sites.cached_activities_by_type": 0,
          "sites.cached_device_activity_summary": 0,
          "sites.cached_latest_activities_by_type": 0,
          "sites.cached_latest_deployment_activity": 0,
          "sites.cached_latest_maintenance_activity": 0,
          "sites.cached_latest_recall_activity": 0,
          "sites.cached_total_activities": 0,
          "sites.createdAt": 0,
          "sites.lat_long": 0,
          "sites.weather_stations": 0,
          "sites.site_codes": 0,
          "sites.network": 0,
          "sites.grids": 0,
        },
      },
      kyaTasks: {
        inclusion: {
          _id: 1,
          title: 1,
          content: 1,
          image: 1,
          task_position: 1,
          kya_lesson: {
            $arrayElemAt: ["$kyalessons", 0],
          },
        },
        exclusion: { nothing: 0 },
      },
      kyaQuiz: {
        inclusion: {
          _id: 1,
          title: 1,
          completion_message: 1,
          description: 1,
          image: 1,
          questions: 1,
          active_question: {
            $arrayElemAt: ["$kya_user_quiz_progress.active_question", 0],
          },
          status: { $arrayElemAt: ["$kya_user_quiz_progress.status", 0] },
        },
        exclusion: { nothing: 0 },
      },
      kyaQuestions: {
        inclusion: {
          _id: 1,
          title: 1,
          context: 1,
          question_position: 1,
          answers: 1,
          kya_quiz_id: {
            $arrayElemAt: ["$kyaquiz._id", 0],
          },
          kya_quiz_title: {
            $arrayElemAt: ["$kyaquiz.title", 0],
          },
        },
        exclusion: { nothing: 0 },
      },
      kyaLessons: {
        inclusion: {
          _id: 1,
          title: 1,
          completion_message: 1,
          image: 1,
          tasks: 1,
          active_task: { $arrayElemAt: ["$kya_user_progress.active_task", 0] },
          status: { $arrayElemAt: ["$kya_user_progress.status", 0] },
        },
        exclusion: { nothing: 0 },
      },
      kyaQuizProgress: {
        inclusion: {
          user_id: 1,
          quiz_id: 1,
          active_question: 1,
          status: 1,
          _id: 1,
        },
        exclusion: { nothing: 0 },
      },
      kyaLessonsProgress: {
        inclusion: {
          user_id: 1,
          lesson_id: 1,
          active_task: 1,
          status: 1,
          completed: 1,
          _id: 1,
        },
        exclusion: { nothing: 0 },
      },
      adminLevel: {
        inclusion: { description: 1, name: 1, _id: 1 },
        exclusion: { nothing: 0 },
      },
      network: {
        inclusion: { description: 1, name: 1, _id: 1 },
        exclusion: { nothing: 0 },
      },
      siteActivities: {
        inclusion: {
          _id: 1,
          device: 1,
          date: 1,
          description: 1,
          network: 1,
          groups: 1,
          activityType: 1,
          maintenanceType: 1,
          recallType: 1,
          nextMaintenance: 1,
          createdAt: 1,
          updatedAt: 1,
          activity_codes: 1,
          tags: 1,
          host_id: 1,
          user_id: 1,
          site_id: 1,
          firstName: 1,
          lastName: 1,
          userName: 1,
          email: 1,
        },
        exclusion: { nothing: 0 },
      },
    };

    // Define path-specific modifications
    this.pathStrategies = {
      // GRIDS path strategies
      grids: {
        summary: {
          additionalExclusions: {
            shape: 0,
            grid_tags: 0,
            grid_codes: 0,
            centers: 0,
            "sites.latitude": 0,
            "sites.longitude": 0,
            "sites.generated_name": 0,
            "sites.bearing_in_radians": 0,
            "sites.approximate_distance_in_km": 0,
            "sites.site_category": 0,
            "sites.isOnline": 0,
            "sites.lastActive": 0,
          },
        },
        public: {
          overrideExclusion: {
            long_name: 0,
            grid_tags: 0,
            grid_codes: 0,
            centers: 0,
            shape: 0,
            network: 0,
            sites: 0,
            numberOfSites: 0,
          },
        },
      },

      kyaQuizProgress: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {},
        },
      },

      // KYA LESSONS PROGRESS path strategies
      kyaLessonsProgress: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {
            // Add fields to exclude for public path if needed
          },
        },
      },

      //KYA LESSONS path strategies
      kyaLessons: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {
            // Add fields to exclude for public path if needed
          },
        },
      },

      kyaTasks: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {},
        },
      },

      kyaQuiz: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {},
        },
      },

      kyaQuestions: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {},
        },
      },

      kyaAnswers: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {},
        },
      },

      adminLevel: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {},
        },
      },

      network: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {},
        },
      },

      siteActivities: {
        summary: {
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {},
        },
      },

      sites: {
        summary: {
          additionalExclusions: {
            nearest_tahmo_station: 0,
            images: 0,
            site_codes: 0,
            site_tags: 0,
            network: 0,
            bearing_in_radians: 0,
            approximate_distance_in_km: 0,
            lat_long: 0,
            altitude: 0,
            distance_to_kampala_center: 0,
            distance_to_capital_city_center: 0,
            distance_to_nearest_primary_road: 0,
            distance_to_nearest_residential_road: 0,
            distance_to_nearest_road: 0,
            distance_to_nearest_secondary_road: 0,
            distance_to_nearest_tertiary_road: 0,
            distance_to_nearest_unclassified_road: 0,
            aspect: 0,
            bearing_to_kampala_center: 0,
            bearing_to_capital_city_center: 0,
            landform_270: 0,
            landform_90: 0,
            greenness: 0,
            "devices.visibility": 0,
            "devices.mobility": 0,
            "devices.device_codes": 0,
            "devices.status": 0,
            "devices.grids": 0,
            "devices.cohorts": 0,
            "devices.host_id": 0,
            "devices.lastActive": 0,
            "devices.isOnline": 0,
            "devices.isPrimaryInLocation": 0,
            "devices.category": 0,
            "devices.isActive": 0,
            "devices.name": 0,
            "devices.device_number": 0,
            "devices.network": 0,
            "devices.createdAt": 0,
            "devices.approximate_distance_in_km": 0,
            "devices.bearing_in_radians": 0,
            "devices.latitude": 0,
            "devices.longitude": 0,
            "devices.previous_sites": 0,
            "airqlouds.nearest_tahmo_station": 0,
            "airqlouds.images": 0,
            "airqlouds.site_codes": 0,
            "airqlouds.site_tags": 0,
            "airqlouds.city": 0,
            "airqlouds.district": 0,
            "airqlouds.county": 0,
            "airqlouds.region": 0,
            "airqlouds.country": 0,
            "airqlouds.latitude": 0,
            "airqlouds.longitude": 0,
            "airqlouds.network": 0,
            "airqlouds.approximate_latitude": 0,
            "airqlouds.approximate_longitude": 0,
            "airqlouds.bearing_in_radians": 0,
            "airqlouds.approximate_distance_in_km": 0,
            "airqlouds.lat_long": 0,
            "airqlouds.generated_name": 0,
            "airqlouds.altitude": 0,
            "airqlouds.description": 0,
            "airqlouds.weather_stations": 0,
            "airqlouds.createdAt": 0,
            "airqlouds.devices": 0,
            "grids.admin_level": 0,
            "grids.visibility": 0,
            "grids.shape_update_history": 0,
            "grids.activeMobileDevices": 0,
            "activities.activity_codes": 0,
            "activities.user_id": 0,
            "activities.host_id": 0,
            "activities.network": 0,
            "activities.groups": 0,
            "activities.updatedAt": 0,
          },
        },
        public: {
          overrideExclusion: {
            latitude: 0,
            longitude: 0,
            grids: 0,
            approximate_distance_in_km: 0,
            bearing_in_radians: 0,
            site_tags: 0,
            site_codes: 0,
            lat_long: 0,
            network: 0,
            data_provider: 0,
            generated_name: 0,
            county: 0,
            altitude: 0,
            greenness: 0,
            landform_270: 0,
            landform_90: 0,
            aspect: 0,
            status: 0,
            images: 0,
            share_links: 0,
            distance_to_nearest_road: 0,
            distance_to_nearest_primary_road: 0,
            distance_to_nearest_secondary_road: 0,
            distance_to_nearest_tertiary_road: 0,
            distance_to_nearest_unclassified_road: 0,
            distance_to_nearest_residential_road: 0,
            bearing_to_kampala_center: 0,
            distance_to_kampala_center: 0,
            bearing_to_capital_city_center: 0,
            distance_to_capital_city_center: 0,
            createdAt: 0,
            nearest_tahmo_station: 0,
            devices: 0,
            airqlouds: 0,
            activities: 0,
            latest_deployment_activity: 0,
            latest_maintenance_activity: 0,
            latest_recall_activity: 0,
            site_creation_activity: 0,
            total_activities: 0,
          },
        },
      },

      devices: {
        summary: {
          additionalExclusions: {
            alias: 0,
            approximate_distance_in_km: 0,
            bearing_in_radians: 0,
            ISP: 0,
            phoneNumber: 0,
            visibility: 0,
            isPrimaryInLocation: 0,
            nextMaintenance: 0,
            deployment_date: 0,
            name_id: 0,
            writeKey: 0,
            recall_date: 0,
            maintenance_date: 0,
            access_code: 0,
            height: 0,
            host: 0,
            "activities.activity_codes": 0,
            "activities.user_id": 0,
            "activities.host_id": 0,
            "activities.network": 0,
            "activities.groups": 0,
            "activities.updatedAt": 0,
          },
        },
        public: {
          overrideExclusion: {
            alias: 0,
            latitude: 0,
            longitude: 0,
            approximate_distance_in_km: 0,
            bearing_in_radians: 0,
            ISP: 0,
            phoneNumber: 0,
            visibility: 0,
            description: 0,
            isPrimaryInLocation: 0,
            nextMaintenance: 0,
            deployment_date: 0,
            name_id: 0,
            recall_date: 0,
            maintenance_date: 0,
            device_number: 0,
            powerType: 0,
            mountType: 0,
            isActive: 0,
            writeKey: 0,
            readKey: 0,
            access_code: 0,
            device_codes: 0,
            height: 0,
            mobility: 0,
            network: 0,
            category: 0,
            host: 0,
            cohorts: 0,
            site: 0,
            status: 0,
            previous_sites: 0,
            long_name: 0,
            activities: 0,
            latest_deployment_activity: 0,
            latest_maintenance_activity: 0,
            latest_recall_activity: 0,
            total_activities: 0,
          },
        },
      },

      // Add all other entity path strategies...
      cohorts: {
        summary: {
          // Empty, just to show structure
          additionalExclusions: {},
        },
        public: {
          overrideExclusion: {
            network: 0,
            cohort_tags: 0,
            visibility: 0,
            cohort_codes: 0,
            devices: 0,
            numberOfDevices: 0,
          },
        },
      },

      airqlouds: {
        summary: {
          additionalExclusions: {
            location: 0,
            isCustom: 0,
            metadata: 0,
            center_point: 0,
            airqloud_codes: 0,
            description: 0,
            airqloud_tags: 0,
            "sites.approximate_latitude": 0,
            "sites.approximate_longitude": 0,
            "sites.bearing_in_radians": 0,
            "sites.approximate_distance_in_km": 0,
            "sites.generated_name": 0,
            "sites.location_name": 0,
            "sites.search_name": 0,
            "sites.images": 0,
            "sites.land_use": 0,
            "sites.city": 0,
            "sites.district": 0,
            "sites.county": 0,
            "sites.region": 0,
            "sites.country": 0,
            "sites.latitude": 0,
            "sites.longitude": 0,
          },
        },
        dashboard: {
          additionalExclusions: {
            location: 0,
          },
        },
        public: {
          overrideExclusion: {
            location: 0,
            airqloud_codes: 0,
            numberOfSites: 0,
            airqloud_tags: 0,
            isCustom: 0,
            metadata: 0,
            center_point: 0,
            sites: 0,
          },
        },
      },

      // For events metadata, we need a special handler
      eventsMetadata: {
        device: {
          deviceExclusions: {
            ISP: 0,
            height: 0,
            device_number: 0,
            description: 0,
            isUsedForCollocation: 0,
            powerType: 0,
            mountType: 0,
            createdAt: 0,
            updatedAt: 0,
            isActive: 0,
            site_id: 0,
            long_name: 0,
            readKey: 0,
            writeKey: 0,
            phoneNumber: 0,
            deployment_date: 0,
            nextMaintenance: 0,
            recall_date: 0,
            maintenance_date: 0,
            siteName: 0,
            locationName: 0,
            device_manufacturer: 0,
            product_name: 0,
            visibility: 0,
            owner: 0,
            onlineStatusAccuracy: 0,
            activities_cache_updated_at: 0,
            cached_activities_by_type: 0,
            cached_device_activity_summary: 0,
            cached_latest_activities_by_type: 0,
            cached_latest_deployment_activity: 0,
            cached_latest_maintenance_activity: 0,
            cached_latest_recall_activity: 0,
            cached_total_activities: 0,
          },
        },
        site: {
          siteExclusions: {
            nearest_tahmo_station: 0,
            site_tags: 0,
            formatted_name: 0,
            geometry: 0,
            google_place_id: 0,
            town: 0,
            city: 0,
            county: 0,
            lat_long: 0,
            altitude: 0,
            updatedAt: 0,
            airqloud_id: 0,
            sub_county: 0,
            parish: 0,
            greenness: 0,
            landform_90: 0,
            landform_270: 0,
            aspect: 0,
            distance_to_nearest_road: 0,
            distance_to_nearest_primary_road: 0,
            distance_to_nearest_tertiary_road: 0,
            distance_to_nearest_unclassified_road: 0,
            distance_to_nearest_residential_road: 0,
            bearing_to_kampala_center: 0,
            bearing_to_capital_city_center: 0,
            street: 0,
            village: 0,
            distance_to_nearest_secondary_road: 0,
            distance_to_kampala_center: 0,
            distance_to_capital_city_center: 0,
            onlineStatusAccuracy: 0,
            activities_cache_updated_at: 0,
            cached_activities_by_type: 0,
            cached_device_activity_summary: 0,
            cached_latest_activities_by_type: 0,
            cached_latest_deployment_activity: 0,
            cached_latest_maintenance_activity: 0,
            cached_latest_recall_activity: 0,
            cached_total_activities: 0,
            weather_stations: 0,
            site_category: 0,
          },
        },
        brief_site: {
          briefSiteExclusions: {
            nearest_tahmo_station: 0,
            site_tags: 0,
            geometry: 0,
            google_place_id: 0,
            lat_long: 0,
            altitude: 0,
            updatedAt: 0,
            airqloud_id: 0,
            greenness: 0,
            landform_90: 0,
            landform_270: 0,
            aspect: 0,
            distance_to_nearest_road: 0,
            distance_to_nearest_primary_road: 0,
            distance_to_nearest_tertiary_road: 0,
            distance_to_nearest_unclassified_road: 0,
            distance_to_nearest_residential_road: 0,
            bearing_to_kampala_center: 0,
            bearing_to_capital_city_center: 0,
            longitude: 0,
            latitude: 0,
            land_use: 0,
            site_codes: 0,
            grids: 0,
            images: 0,
            airqlouds: 0,
            generated_name: 0,
            createdAt: 0,
            __v: 0,
            network: 0,
            approximate_distance_in_km: 0,
            distance_to_nearest_secondary_road: 0,
            distance_to_kampala_center: 0,
            distance_to_capital_city_center: 0,
            onlineStatusAccuracy: 0,
            activities_cache_updated_at: 0,
            cached_activities_by_type: 0,
            cached_device_activity_summary: 0,
            cached_latest_activities_by_type: 0,
            cached_latest_deployment_activity: 0,
            cached_latest_maintenance_activity: 0,
            cached_latest_recall_activity: 0,
            cached_total_activities: 0,
            weather_stations: 0,
            site_category: 0,
          },
        },
      },
    };

    this.ensureAllProjectionsExist();
  }

  /**
   * Get projections for a specific entity and path
   * @param {string} entity - The entity type (grids, sites, devices, etc.)
   * @param {string} path - The path type (summary, public, etc.)
   * @returns {Object} - The inclusion and exclusion projections
   */
  getProjections(entity, path = "none") {
    logText(`Getting projections for ${entity} with path ${path}`);

    // Convert entity name to lowercase for case-insensitive comparison
    const entityLower = entity.toLowerCase();

    // Map common entity name variations to standardized keys
    const entityMap = {
      kyalessons: "kyaLessons",
      kyalesson: "kyaLessons",
      kyalessonsprogress: "kyaLessonsProgress",
      kyalessons_progress: "kyaLessonsProgress",
      kya_lessons_progress: "kyaLessonsProgress",
      kyaprogress: "kyaLessonsProgress",
      kya_progress: "kyaLessonsProgress",
      kya_lessons: "kyaLessons",
      kyaquizprogress: "kyaQuizProgress",
      kyaquiz_progress: "kyaQuizProgress",
      kya_quiz_progress: "kyaQuizProgress",
      kyalessonsprogress: "kyaLessonsProgress",
      kyalessons_progress: "kyaLessonsProgress",
      kya_lessons_progress: "kyaLessonsProgress",
      kyaprogress: "kyaLessonsProgress",
      kya_progress: "kyaLessonsProgress",
      kya_user_progress: "kyaLessonsProgress",
      kya_user_quiz_progress: "kyaQuizProgress",
      kyauserquizprogress: "kyaQuizProgress",
      kyauserlessonprogress: "kyaLessonsProgress",
      kya_lesson: "kyaLessons",
      kyatasks: "kyaTasks",
      kyatask: "kyaTasks",
      kya_tasks: "kyaTasks",
      kya_task: "kyaTasks",
      kyaquiz: "kyaQuiz",
      kya_quiz: "kyaQuiz",
      kyaquizzes: "kyaQuiz",
      kyaquestions: "kyaQuestions",
      kyaquestion: "kyaQuestions",
      kya_questions: "kyaQuestions",
      kya_question: "kyaQuestions",
      kyaanswers: "kyaAnswers",
      kyaanswer: "kyaAnswers",
      kya_answers: "kyaAnswers",
      kya_answer: "kyaAnswers",
      airqlouds: "airqlouds",
      airqloud: "airqlouds",
      air_qlouds: "airqlouds",
      air_qloud: "airqlouds",
    };

    // Use mapped entity name if available, otherwise use the original
    const mappedEntity = entityMap[entityLower] || entity;

    // Get base projections for the entity
    const baseProjection = this.baseProjections[mappedEntity];
    if (!baseProjection) {
      logText(
        `No base projection found for entity: ${entity} (mapped to ${mappedEntity})`
      );
      return {
        inclusionProjection: {},
        exclusionProjection: {},
      };
    }

    // Get path strategy for this entity
    const entityPathStrategies = this.pathStrategies[mappedEntity];
    if (!entityPathStrategies || !entityPathStrategies[path]) {
      logText(
        `No path strategy found for ${mappedEntity} with path ${path}, using base projections`
      );
      return {
        inclusionProjection: baseProjection.inclusion,
        exclusionProjection: baseProjection.exclusion,
      };
    }

    const pathStrategy = entityPathStrategies[path];

    // If path strategy has override, use it instead of base exclusion
    if (pathStrategy.overrideExclusion) {
      logObject(
        `Using override exclusion for ${mappedEntity} with path ${path}`,
        pathStrategy.overrideExclusion
      );
      return {
        inclusionProjection: baseProjection.inclusion,
        exclusionProjection: pathStrategy.overrideExclusion,
      };
    }

    // Merge base exclusions with path-specific additional exclusions
    const mergedExclusions = this.cleanupDuplicateProperties({
      ...baseProjection.exclusion,
      ...(pathStrategy.additionalExclusions || {}),
    });

    logObject(
      `Using merged exclusions for ${mappedEntity} with path ${path}`,
      mergedExclusions
    );
    return {
      inclusionProjection: baseProjection.inclusion,
      exclusionProjection: mergedExclusions,
    };
  }

  /**
   * Cleans up duplicate properties in a projection object
   * @param {Object} projection - The projection object to clean
   * @returns {Object} - The cleaned projection object
   */

  cleanupDuplicateProperties(projection) {
    return { ...projection };
  }

  /**
   * Ensures all required projections exist in the baseProjections object and
   * initializes them if they are missing.
   */
  ensureAllProjectionsExist() {
    // Define a list of all required projections
    const requiredProjections = [
      "grids",
      "sites",
      "devices",
      "cohorts",
      "airqlouds",
      "kyaLessons",
      "kyaTasks",
      "kyaQuiz",
      "kyaQuestions",
      "kyaAnswers",
      "kyaQuizProgress",
      "kyaLessonsProgress",
      "adminLevel",
      "network",
      "siteActivities",
    ];

    // Check each required projection exists in baseProjections
    for (const projection of requiredProjections) {
      if (!this.baseProjections[projection]) {
        logText(`Warning: Missing base projection for '${projection}'`);
        // Create a default empty projection
        this.baseProjections[projection] = {
          inclusion: { _id: 1 },
          exclusion: { nothing: 0 },
        };
      }

      // Also ensure a path strategy exists
      if (!this.pathStrategies[projection]) {
        logText(`Warning: Missing path strategy for '${projection}'`);
        this.pathStrategies[projection] = {
          summary: { additionalExclusions: {} },
        };
      }
    }
  }

  /**
   * Special handler for events metadata projection
   * @param {string} entity - The entity type (device, site, brief_site)
   * @param {string} as - The field name to project as
   * @returns {Object} - The projection object
   */
  getEventsMetadataProjection(entity, as) {
    const entityStrategy = this.pathStrategies.eventsMetadata[entity];
    if (!entityStrategy) {
      return {};
    }

    // Handle the special case
    let projection = {};
    projection[as] = {};

    if (entity === "device" && entityStrategy.deviceExclusions) {
      Object.keys(entityStrategy.deviceExclusions).forEach((key) => {
        projection[as][key] = entityStrategy.deviceExclusions[key];
      });
    } else if (entity === "site" && entityStrategy.siteExclusions) {
      Object.keys(entityStrategy.siteExclusions).forEach((key) => {
        projection[as][key] = entityStrategy.siteExclusions[key];
      });
    } else if (entity === "brief_site" && entityStrategy.briefSiteExclusions) {
      Object.keys(entityStrategy.briefSiteExclusions).forEach((key) => {
        projection[as][key] = entityStrategy.briefSiteExclusions[key];
      });
    }

    return projection;
  }
}

// Create singleton instance
const projectionFactory = new ProjectionFactory();

// Export the projection methods in the format your application expects
const dbProjections = {
  //for backward compatibility
  _getProjectionValue(key, fallbackValue, ...args) {
    // Check if the property exists on this object
    if (!(key in this)) {
      logText(`Warning: Projection '${key}' not found, using fallback`);
      return fallbackValue;
    }

    // Handle both function and non-function properties
    if (typeof this[key] === "function") {
      return thiskey;
    } else {
      return this[key];
    }
  },

  //  for safer access to projections
  ensureProjectionFunction(projectionName) {
    if (!this[projectionName]) {
      logText(
        `Warning: Projection '${projectionName}' not found, creating default`
      );
      // Create a default projection function that returns nothing: 0
      this[projectionName] = () => ({ nothing: 0 });
    } else if (typeof this[projectionName] !== "function") {
      const originalValue = this[projectionName];
      logText(
        `Warning: Projection '${projectionName}' is not a function, converting`
      );
      // Convert non-function projection to function
      this[projectionName] = () => originalValue;
    }
    return this[projectionName];
  },
  KYA_QUIZ_PROGRESS_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.kyaQuizProgress.inclusion,
  KYA_QUIZ_PROGRESS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "kyaQuizProgress",
      path
    );
    return exclusionProjection;
  },
  KYA_QUIZ_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.kyaQuiz.inclusion,
  KYA_QUIZ_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "kyaQuiz",
      path
    );
    return exclusionProjection;
  },
  KYA_LESSONS_PROGRESS_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.kyaLessonsProgress.inclusion,
  KYA_LESSONS_PROGRESS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "kyaLessonsProgress",
      path
    );
    return exclusionProjection;
  },
  /**
   *
   * @param {*} entity
   * @param {*} path
   * @returns
   */
  getExclusionProjection(entity, path = "none") {
    if (!entity) {
      logText(`Warning: No entity provided for exclusion projection`);
      return { nothing: 0 }; // Safe fallback
    }

    try {
      // Convert entity name to a standard projection key format
      const keyName =
        entity
          .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camelCase → snake_case
          .replace(/-/g, "_") // kebab-case → snake_case
          .toUpperCase() + "_EXCLUSION_PROJECTION";

      // If the projection exists as a function, call it
      if (typeof this[keyName] === "function") {
        return thiskeyName;
      }

      // If it exists as an object, return it
      if (this[keyName] && typeof this[keyName] === "object") {
        return this[keyName];
      }

      // Otherwise use the factory to get a projection
      logText(
        `Using factory method to generate exclusion for: ${entity} with path: ${path}`
      );
      const { exclusionProjection } = projectionFactory.getProjections(
        entity,
        path
      );
      return exclusionProjection;
    } catch (error) {
      logText(
        `Error getting exclusion projection for ${entity}: ${error.message}`
      );
      return { nothing: 0 }; // Safe fallback in case of errors
    }
  },
  KYA_ANSWERS_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.kyaAnswers.inclusion,
  KYA_ANSWERS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "kyaAnswers",
      path
    );
    return exclusionProjection;
  },

  KYA_QUESTIONS_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.kyaQuestions.inclusion,
  KYA_QUESTIONS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "kyaQuestions",
      path
    );
    return exclusionProjection;
  },

  KYA_TASKS_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.kyaTasks.inclusion,
  KYA_TASKS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "kyaTasks",
      path
    );
    return exclusionProjection;
  },

  ADMIN_LEVEL_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.adminLevel.inclusion,
  ADMIN_LEVEL_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "adminLevel",
      path
    );
    return exclusionProjection;
  },

  NETWORK_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.network.inclusion,
  NETWORK_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "network",
      path
    );
    return exclusionProjection;
  },

  SITE_ACTIVITIES_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.siteActivities.inclusion,
  SITE_ACTIVITIES_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "siteActivities",
      path
    );
    return exclusionProjection;
  },
  // Grids projections
  GRIDS_INCLUSION_PROJECTION: projectionFactory.baseProjections.grids.inclusion,
  GRIDS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "grids",
      path
    );
    return exclusionProjection;
  },

  // KYA Lessons projections
  KYA_LESSONS_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.kyaLessons.inclusion,
  KYA_LESSONS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "kyaLessons",
      path
    );
    return exclusionProjection;
  },

  // Sites projections
  SITES_INCLUSION_PROJECTION: projectionFactory.baseProjections.sites.inclusion,
  SITES_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "sites",
      path
    );
    return exclusionProjection;
  },

  // Devices projections
  DEVICES_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.devices.inclusion,
  DEVICES_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "devices",
      path
    );
    return exclusionProjection;
  },

  // Cohorts projections
  COHORTS_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.cohorts.inclusion,
  COHORTS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "cohorts",
      path
    );
    return exclusionProjection;
  },

  // AirQlouds projections
  AIRQLOUDS_INCLUSION_PROJECTION:
    projectionFactory.baseProjections.airqlouds.inclusion,
  AIRQLOUDS_EXCLUSION_PROJECTION: (path) => {
    const { exclusionProjection } = projectionFactory.getProjections(
      "airqlouds",
      path
    );
    return exclusionProjection;
  },

  // Events metadata projection
  EVENTS_METADATA_PROJECTION: (entity, as) => {
    return projectionFactory.getEventsMetadataProjection(entity, as);
  },

  // Add all other exported projections...

  // Include the fields to exclude constants
  GRID_SHAPE_FIELDS_TO_EXCLUDE: ["coordinates"],
  SITE_FIELDS_TO_EXCLUDE: [
    "altitude",
    "greenness",
    "landform_90",
    "landform_270",
    "aspect",
    "altitude",
    "greenness",
    "landform_90",
    "landform_270",
    "aspect",
    "distance_to_nearest_road",
    "distance_to_nearest_primary_road",
    "distance_to_nearest_secondary_road",
    "distance_to_nearest_tertiary_road",
    "distance_to_nearest_unclassified_road",
    "distance_to_nearest_residential_road",
    "bearing_to_kampala_center",
    "distance_to_kampala_center",
    "bearing_to_capital_city_center",
    "distance_to_capital_city_center",
    "updatedAt",
    "nearest_tahmo_station",
    "formatted_name",
    "geometry",
    "google_place_id",
    "site_tags",
    "street",
    "town",
    "village",
    "airqlouds",
    "description",
    "__v",
    "airqloud_id",
    "createdAt",
    "lat_long",
    "weather_stations",
    "site_codes",
    "network",
    "grids",
    "approximate_latitude",
    "approximate_longitude",
    "bearing_in_radians",
    "approximate_distance_in_km",
    "generated_name",
    "location_name",
    "search_name",
    "sub_county",
    "city",
    "district",
    "county",
    "region",
    "country",
    "latitude",
    "longitude",
    "images",
    "land_use",
  ],
  DEVICE_FIELDS_TO_EXCLUDE: [
    "ISP",
    "device_manufacturer",
    "height",
    "isActive",
    "isPrimaryInLocation",
    "latitude",
    "locationName",
    "longitude",
    "mobility",
    "mountType",
    "nextMaintenance",
    "owner",
    "phoneNumber",
    "powerType",
    "product_name",
    "siteName",
    "isRetired",
    "updatedAt",
    "visibility",
    "site_id",
    "readKey",
    "writeKey",
    "deployment_date",
    "isUsedForCollocation",
    "recall_date",
    "maintenance_date",
    "status",
    "device_codes",
    "alias",
    "cohorts",
    "generation_version",
    "generation_count",
    "tags",
    "category",
    "pictures",
    "__v",
    "approximate_distance_in_km",
    "bearing_in_radians",
    "previous_sites",
    "long_name",
    "network",
    "device_number",
    "createdAt",
    "description",
  ],
  initializeAllProjections() {
    const requiredProjections = [
      "KYA_LESSONS_EXCLUSION_PROJECTION",
      "KYA_LESSONS_PROGRESS_EXCLUSION_PROJECTION",
      "KYA_QUIZ_PROGRESS_EXCLUSION_PROJECTION",
      "KYA_TASKS_EXCLUSION_PROJECTION",
      "KYA_QUIZ_EXCLUSION_PROJECTION",
      "KYA_QUESTIONS_EXCLUSION_PROJECTION",
      "KYA_ANSWERS_EXCLUSION_PROJECTION",
    ];

    for (const projection of requiredProjections) {
      this.ensureProjectionFunction(projection);
    }

    return this;
  },
};

dbProjections.initializeAllProjections();

module.exports = dbProjections;
