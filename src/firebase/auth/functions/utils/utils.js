/* eslint-disable */
require("dotenv").config();

const functions = require("firebase-functions");
const axios = require("axios");

const { firestoreDb } = require("./firebaseConfig");
const { getAuth } = require("firebase-admin/auth");
const admin = require("firebase-admin");

const headers = {
    "Authorization": process.env.JWT_TOKEN,
};


const utils = {

    addAttachment: (attachmentsSet, filename, path, cid) => {
        if (!attachmentsSet.has(cid)) {
            attachmentsSet.add({
                filename,
                path,
                cid,
            });
        }
    },

    mapPMValues: (pm) => {
        if (pm >= 0 && pm <= 12) {
            return "good";
        } else if (pm > 12 && pm <= 35.4) {
            return "moderate";
        } else if (pm > 35.4 && pm <= 55.4) {
            return "uhfsg";
        } else if (pm > 55.4 && pm <= 150.4) {
            return "unhealthy";
        } else if (pm > 150.4 && pm <= 250.4) {
            return "veryUnhealthy";
        } else {
            return "hazardous";
        }
    },

    checkSubscription: async (userID) => {
        const userRef = firestoreDb.collection(process.env.USERS_COLLECTION).doc(userID);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            const isSubscribedToEmailNotifs = userDoc.data().isSubscribedToEmailNotifs !== false;
            return isSubscribedToEmailNotifs;
        }
        return false;

    },

    getAllUsers: async () => {
        try {
            let allUsers = [];
            let pageToken = undefined;

            do {
                // Fetch users in batches
                const result = await admin.auth().listUsers(1000, pageToken);
                const users = result.users;
                allUsers = allUsers.concat(users);

                // Update the pageToken for the next iteration
                pageToken = result.pageToken;
            } while (pageToken);

            allUsers = allUsers.filter(async (user) => {
                return await utils.checkSubscription(user.uid);
            });

            return allUsers;
        } catch (error) {
            functions.logger.error("Error getting users", error);
        }
    },

    groupFavorites: async (groupingType) => {

        const responseFromGetFavorites = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/users/favorites`,
            { headers: headers });

        const groupedFavorites = {};
        if (responseFromGetFavorites.data.success === true) {
            const favorites = responseFromGetFavorites.data.favorites;


            for (const favorite of favorites) {
                try {
                    const placeId = favorite.place_id;
                    const userID = favorite.firebase_user_id;
                    const user = await getAuth().getUser(userID);
                    const userEmail = user.email;
                    const userRef = firestoreDb.collection(process.env.USERS_COLLECTION).doc(userID);
                    const userDoc = await userRef.get();

                    if (userDoc.exists) {
                        const isSubscribedToEmailNotifs = utils.checkSubscription(userID);

                        if (userEmail && isSubscribedToEmailNotifs) {
                            const { name, location } = favorite;

                            if (!groupedFavorites[userID]) {
                                groupedFavorites[userID] = [];
                            }

                            if (groupingType === "forecast") {
                                const responseFromGetForecast = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/predict/daily-forecast?site_id=${favorite.place_id}`,
                                    { headers: headers });
                                if (responseFromGetForecast.status !== 200) {
                                    functions.logger.error("Error getting Forecast", responseFromGetForecast);
                                    return {
                                        success: false,
                                        error: error,
                                    };
                                }
                                const pmValues = responseFromGetForecast.data.forecasts.map((forecast) => forecast.pm2_5);
                                const airQualityLevels = pmValues.map(utils.mapPMValues);
                                groupedFavorites[userID].push({ name, location, userEmail, airQualityLevels, placeId });
                            } else if (groupingType === "weekly") {
                                groupedFavorites[userID].push({ name, location, userEmail, placeId });
                            }
                        }
                    }
                } catch (error) {
                    functions.logger.error("Error grouping favorites", error);
                    return {
                        success: false,
                        error: error,
                    };
                }
            }

        }
        else {
            functions.logger.error("Error fetching Favorites", responseFromGetFavorites);
            return {
                success: false,
                error: responseFromGetFavorites,
            };
        }
        return groupedFavorites;
    },

    groupPushNotifications: async (users) => {
        let groupedUsers = {};
        let placeGroupings = [];
        try {
            for (const user of users) {
                let name, location, placeId;

                const responseFromGetFavorites = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/users/favorites/users/${user.uid}`,
                    { headers: headers });
                if (responseFromGetFavorites.data.success !== true) {
                    functions.logger.error("Error fetching Favorites", responseFromGetFavorites.data);
                }
                placeGroupings = responseFromGetFavorites.data.favorites;
                if (placeGroupings.length === 0) {
                    // functions.logger.log(`User ${user.uid} has no Favorites`);
                    const responsefromGetLocationHistories = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/users/locationHistory/users/${user.uid}`,
                        { headers: headers });
                    if (responsefromGetLocationHistories.data.success !== true) {
                        functions.logger.error("Error fetching Location Histories", responsefromGetLocationHistories.data);
                    }

                    placeGroupings = responsefromGetLocationHistories.data.location_histories;

                    if (placeGroupings.length === 0) {
                        // functions.logger.log(`User ${user.uid} has no Location Histories`);
                        const responsefromGetSearchHistories = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/users/searchHistory/users/${user.uid}`,
                            { headers: headers });
                        if (responsefromGetSearchHistories.data.success !== true) {
                            functions.logger.error("Error fetching Search Histories", responsefromGetSearchHistories.data);
                        }
                        placeGroupings = responsefromGetSearchHistories.data.search_histories;
                        if (placeGroupings.length === 0) {
                            // functions.logger.log(`User ${user.uid} has no Search Histories`);
                            const responsefromGetSites = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/devices/sites/summary`,
                                { headers: headers });
                            if (responsefromGetSites.data.success !== true) {
                                functions.logger.error("Error fetching Sites", responsefromGetSites.data);
                            }
                            const sites = responsefromGetSites.data.sites;
                            const randomIndex = Math.floor(Math.random() * sites.length);
                            const targetPlace = sites[randomIndex];
                            name = targetPlace.search_name
                            location = targetPlace.location_name
                            placeId = targetPlace._id
                        }

                    }
                }
                if (placeGroupings.length !== 0) {
                    const randomIndex = Math.floor(Math.random() * placeGroupings.length);
                    const targetPlace = placeGroupings[randomIndex];

                    name = targetPlace.name
                    location = targetPlace.location
                    placeId = targetPlace.place_id

                }
                if (!groupedUsers[user.uid]) {
                    groupedUsers[user.uid] = [];
                }
                groupedUsers[user.uid].push({ name, location, placeId });

            }
            return groupedUsers;
        } catch (error) {
            functions.logger.error("Error grouping Users for Push notifications", error);
            return {
                success: false,
                error: error,
            };
        }

    },

};

module.exports = utils;