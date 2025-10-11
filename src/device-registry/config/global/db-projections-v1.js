const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

const dbProjections = {
  EVENTS_METADATA_PROJECTION: (entity, as) => {
    if (entity === "device") {
      let projection = {};
      projection[as] = {};
      projection[as]["ISP"] = 0;
      projection[as]["height"] = 0;
      projection[as]["device_number"] = 0;
      projection[as]["description"] = 0;
      projection[as]["isUsedForCollocation"] = 0;
      projection[as]["powerType"] = 0;
      projection[as]["mountType"] = 0;
      projection[as]["createdAt"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["isActive"] = 0;
      projection[as]["site_id"] = 0;
      projection[as]["long_name"] = 0;
      projection[as]["readKey"] = 0;
      projection[as]["writeKey"] = 0;
      projection[as]["phoneNumber"] = 0;
      projection[as]["deployment_date"] = 0;
      projection[as]["nextMaintenance"] = 0;
      projection[as]["recall_date"] = 0;
      projection[as]["maintenance_date"] = 0;
      projection[as]["siteName"] = 0;
      projection[as]["locationName"] = 0;
      projection[as]["device_manufacturer"] = 0;
      projection[as]["product_name"] = 0;
      projection[as]["visibility"] = 0;
      projection[as]["owner"] = 0;
      return projection;
    } else if (entity === "site") {
      let projection = {};
      projection[as] = {};
      projection[as]["nearest_tahmo_station"] = 0;
      projection[as]["site_tags"] = 0;
      projection[as]["formatted_name"] = 0;
      projection[as]["geometry"] = 0;
      projection[as]["google_place_id"] = 0;
      projection[as]["town"] = 0;
      projection[as]["city"] = 0;
      projection[as]["county"] = 0;
      projection[as]["lat_long"] = 0;
      projection[as]["altitude"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["airqloud_id"] = 0;
      projection[as]["weather_stations"] = 0;
      projection[as]["sub_county"] = 0;
      projection[as]["parish"] = 0;
      projection[as]["greenness"] = 0;
      projection[as]["landform_90"] = 0;
      projection[as]["landform_270"] = 0;
      projection[as]["aspect"] = 0;
      projection[as]["distance_to_nearest_road"] = 0;
      projection[as]["distance_to_nearest_primary_road"] = 0;
      projection[as]["distance_to_nearest_tertiary_road"] = 0;
      projection[as]["distance_to_nearest_unclassified_road"] = 0;
      projection[as]["distance_to_nearest_residential_road"] = 0;
      projection[as]["bearing_to_kampala_center"] = 0;
      projection[as]["bearing_to_capital_city_center"] = 0;
      projection[as]["street"] = 0;
      projection[as]["village"] = 0;
      projection[as]["distance_to_nearest_secondary_road"] = 0;
      projection[as]["distance_to_kampala_center"] = 0;
      projection[as]["distance_to_capital_city_center"] = 0;
      return projection;
    } else if (entity === "brief_site") {
      let projection = {};
      projection[as] = {};
      projection[as]["nearest_tahmo_station"] = 0;
      projection[as]["site_tags"] = 0;
      projection[as]["geometry"] = 0;
      projection[as]["google_place_id"] = 0;
      projection[as]["lat_long"] = 0;
      projection[as]["altitude"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["airqloud_id"] = 0;
      projection[as]["weather_stations"] = 0;
      projection[as]["greenness"] = 0;
      projection[as]["landform_90"] = 0;
      projection[as]["landform_270"] = 0;
      projection[as]["aspect"] = 0;
      projection[as]["distance_to_nearest_road"] = 0;
      projection[as]["distance_to_nearest_primary_road"] = 0;
      projection[as]["distance_to_nearest_tertiary_road"] = 0;
      projection[as]["distance_to_nearest_unclassified_road"] = 0;
      projection[as]["distance_to_nearest_residential_road"] = 0;
      projection[as]["bearing_to_kampala_center"] = 0;
      projection[as]["bearing_to_capital_city_center"] = 0;
      projection[as]["longitude"] = 0;
      projection[as]["latitude"] = 0;
      projection[as]["land_use"] = 0;
      projection[as]["site_codes"] = 0;
      projection[as]["grids"] = 0;
      projection[as]["images"] = 0;
      projection[as]["airqlouds"] = 0;
      projection[as]["generated_name"] = 0;
      projection[as]["createdAt"] = 0;
      projection[as]["updatedAt"] = 0;
      projection[as]["__v"] = 0;
      projection[as]["network"] = 0;
      projection[as]["approximate_distance_in_km"] = 0;
      projection[as]["distance_to_nearest_secondary_road"] = 0;
      projection[as]["distance_to_kampala_center"] = 0;
      projection[as]["distance_to_capital_city_center"] = 0;
      return projection;
    } else {
      return {};
    }
  },
  SITES_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    site_category: 1,
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
    site_category: 1,
    lastActive: 1,
    isOnline: 1,
  },
  SITES_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = {
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
      "grids.shape_update_history": 0,
      "grids.shape": 0,
      "grids.network": 0,
      "grids.centers": 0,
      "grids.createdAt": 0,
      "grids.updatedAt": 0,
      "grids.__v": 0,
    };

    let projection = Object.assign({}, initialProjection);

    if (path === "summary") {
      projection = Object.assign(projection, {
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
        weather_stations: 0,
        greenness: 0,
        createdAt: 0,
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
        "grids.name": 0,
      });
    }

    if (path === "public") {
      projection = Object.assign(
        {},
        {
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
          weather_stations: 0,
        }
      );
    }
    return projection;
  },
  DEVICES_INCLUSION_PROJECTION: {
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
    previous_sites: 1,
    site: { $arrayElemAt: ["$site", 0] },
    host: { $arrayElemAt: ["$host", 0] },
  },
  DEVICES_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = {
      "site.lat_long": 0,
      "site.country": 0,
      "site.district": 0,
      "site.sub_county": 0,
      "site.parish": 0,
      "site.county": 0,
      "site.altitude": 0,
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
      "site.description": 0,
      "site.network": 0,
      "site.weather_stations": 0,
      "site.createdAt": 0,
      "site.bearing_in_radians": 0,
      "site.approximate_distance_in_km": 0,
      "previous_sites.lat_long": 0,
      "previous_sites.country": 0,
      "previous_sites.district": 0,
      "previous_sites.sub_county": 0,
      "previous_sites.parish": 0,
      "previous_sites.county": 0,
      "previous_sites.altitude": 0,
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
    };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign(initialProjection, {
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
        powerType: 0,
        mountType: 0,
        access_code: 0,
        height: 0,
        mobility: 0,
        host: 0,
      });
    }
    if (path === "public") {
      projection = Object.assign(
        {},
        {
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
        }
      );
    }
    return projection;
  },
  GRIDS_INCLUSION_PROJECTION: {
    _id: 1,
    name: 1,
    long_name: 1,
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
    sites: "$sites",
    numberOfSites: {
      $cond: {
        if: { $isArray: "$sites" },
        then: { $size: { $ifNull: ["$sites._id", []] } },
        else: "NA",
      },
    },
  },
  GRIDS_EXCLUSION_PROJECTION: (path) => {
    logObject("path", path);
    const initialProjection = {
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
      "sites.createdAt": 0,
      "sites.lat_long": 0,
      "sites.weather_stations": 0,
      "sites.site_codes": 0,
      "sites.network": 0,
      "sites.grids": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign(initialProjection, {
        shape: 0,
        grid_tags: 0,
        grid_codes: 0,
        centers: 0,
        "sites.latitude": 0,
        "sites.longitude": 0,
        "sites.generated_name": 0,
        "sites.bearing_in_radians": 0,
        "sites.approximate_distance_in_km": 0,
      });
    }
    if (path === "public") {
      projection = Object.assign(
        {},
        {
          long_name: 0,
          grid_tags: 0,
          // visibility: 1,
          grid_codes: 0,
          centers: 0,
          shape: 0,
          network: 0,
          sites: 0,
          numberOfSites: 0,
        }
      );
    }
    return projection;
  },
  COHORTS_INCLUSION_PROJECTION: {
    network: 1,
    name: 1,
    description: 1,
    cohort_tags: 1,
    groups: 1,
    createdAt: 1,
    visibility: 1,
    cohort_codes: 1,
    devices: "$devices",
    numberOfDevices: {
      $cond: {
        if: { $isArray: "$devices" },
        then: { $size: { $ifNull: ["$devices._id", []] } },
        else: "NA",
      },
    },
  },
  COHORTS_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = {
      nothing: 0,
      "devices.ISP": 0,
      "devices.device_manufacturer": 0,
      "devices.height": 0,
      "devices.isActive": 0,
      "devices.isPrimaryInLocation": 0,
      "devices.latitude": 0,
      "devices.locationName": 0,
      "devices.longitude": 0,
      "devices.mobility": 0,
      "devices.mountType": 0,
      "devices.nextMaintenance": 0,
      "devices.owner": 0,
      "devices.phoneNumber": 0,
      "devices.powerType": 0,
      "devices.product_name": 0,
      "devices.isRetired": 0,
      "devices.updatedAt": 0,
      "devices.visibility": 0,
      "devices.site_id": 0,
      "devices.readKey": 0,
      "devices.writeKey": 0,
      "devices.deployment_date": 0,
      "devices.isUsedForCollocation": 0,
      "devices.recall_date": 0,
      "devices.siteName": 0,
      "devices.maintenance_date": 0,
      "devices.device_codes": 0,
      "devices.alias": 0,
      "devices.cohorts": 0,
      "devices.generation_version": 0,
      "devices.generation_count": 0,
      "devices.tags": 0,
      "devices.category": 0,
      "devices.pictures": 0,
      "devices.__v": 0,
      "devices.approximate_distance_in_km": 0,
      "devices.bearing_in_radians": 0,
      "devices.previous_sites": 0,
      "devices.host_id": 0,
      "devices.site.lat_long": 0,
      "devices.site.country": 0,
      "devices.site.district": 0,
      "devices.site.sub_county": 0,
      "devices.site.parish": 0,
      "devices.site.county": 0,
      "devices.site.altitude": 0,
      "devices.site.altitude": 0,
      "devices.site.greenness": 0,
      "devices.site.landform_90": 0,
      "devices.site.landform_270": 0,
      "devices.site.aspect": 0,
      "devices.site.distance_to_nearest_road": 0,
      "devices.site.distance_to_nearest_primary_road": 0,
      "devices.site.distance_to_nearest_secondary_road": 0,
      "devices.site.distance_to_nearest_tertiary_road": 0,
      "devices.site.distance_to_nearest_unclassified_road": 0,
      "devices.site.distance_to_nearest_residential_road": 0,
      "devices.site.bearing_to_kampala_center": 0,
      "devices.site.distance_to_kampala_center": 0,
      "devices.site.bearing_to_capital_city_center": 0,
      "devices.site.distance_to_capital_city_center": 0,
      "devices.site.generated_name": 0,
      "devices.site.updatedAt": 0,
      "devices.site.updatedAt": 0,
      "devices.site.city": 0,
      "devices.site.formatted_name": 0,
      "devices.site.geometry": 0,
      "devices.site.google_place_id": 0,
      "devices.site.region": 0,
      "devices.site.site_tags": 0,
      "devices.site.street": 0,
      "devices.site.town": 0,
      "devices.site.nearest_tahmo_station": 0,
      "devices.site.images": 0,
      "devices.site.airqlouds": 0,
      "devices.site.site_codes": 0,
      "devices.site.land_use": 0,
      "devices.site.latitude": 0,
      "devices.site.longitude": 0,
      "devices.site.approximate_latitude": 0,
      "devices.site.approximate_longitude": 0,
      "devices.site.bearing_in_radians": 0,
      "devices.site.approximate_distance_in_km": 0,
      "devices.site.description": 0,
      "devices.site.network": 0,
      "devices.site.weather_stations": 0,
      "devices.site.createdAt": 0,
      "devices.site.__v": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    if (path === "public") {
      projection = Object.assign(
        {},
        {
          network: 0,
          cohort_tags: 0,
          visibility: 0,
          cohort_codes: 0,
          devices: 0,
          numberOfDevices: 0,
        }
      );
    }
    return projection;
  },
  AIRQLOUDS_INCLUSION_PROJECTION: {
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
  AIRQLOUDS_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = {
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
      "sites.createdAt": 0,
      "sites.lat_long": 0,
      "sites.weather_stations": 0,
      "sites.site_codes": 0,
      "sites.network": 0,
      "sites.grids": 0,
    };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign(initialProjection, {
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
      });
    }
    if (path === "dashboard") {
      projection = Object.assign(initialProjection, { location: 0 });
    }
    if (path === "public") {
      projection = Object.assign(
        {},
        {
          location: 0,
          airqloud_codes: 0,
          numberOfSites: 0,
          airqloud_tags: 0,
          isCustom: 0,
          metadata: 0,
          center_point: 0,
          sites: 0,
        }
      );
    }
    return projection;
  },
  KYA_TASKS_INCLUSION_PROJECTION: {
    _id: 1,
    title: 1,
    content: 1,
    image: 1,
    task_position: 1,
    kya_lesson: {
      $arrayElemAt: ["$kyalessons", 0],
    },
  },
  KYA_TASKS_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_QUIZ_INCLUSION_PROJECTION: {
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
  KYA_QUIZ_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_QUESTIONS_INCLUSION_PROJECTION: {
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
  KYA_QUESTIONS_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_ANSWERS_INCLUSION_PROJECTION: {
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
  KYA_ANSWERS_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_LESSONS_INCLUSION_PROJECTION: {
    _id: 1,
    title: 1,
    completion_message: 1,
    image: 1,
    tasks: 1,
    active_task: { $arrayElemAt: ["$kya_user_progress.active_task", 0] },
    status: { $arrayElemAt: ["$kya_user_progress.status", 0] },
  },
  KYA_LESSONS_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_QUIZ_PROGRESS_INCLUSION_PROJECTION: {
    user_id: 1,
    quiz_id: 1,
    active_question: 1,
    status: 1,
    _id: 1,
  },
  KYA_QUIZ_PROGRESS_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  KYA_LESSONS_PROGRESS_INCLUSION_PROJECTION: {
    user_id: 1,
    lesson_id: 1,
    active_task: 1,
    status: 1,
    completed: 1,
    _id: 1,
  },
  KYA_LESSONS_PROGRESS_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  ADMIN_LEVEL_INCLUSION_PROJECTION: {
    description: 1,
    name: 1,
    _id: 1,
  },
  ADMIN_LEVEL_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  NETWORK_INCLUSION_PROJECTION: {
    description: 1,
    name: 1,
    _id: 1,
  },
  NETWORK_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
  SITE_ACTIVITIES_INCLUSION_PROJECTION: {
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
  SITE_ACTIVITIES_EXCLUSION_PROJECTION: (path) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (path === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
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
};
module.exports = dbProjections;
