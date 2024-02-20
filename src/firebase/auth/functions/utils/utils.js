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

const MAX_RETRIES = 3;
const RETRY_DELAY = 10000;


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
            const usersSnapshot = await firestoreDb.collection(process.env.USERS_COLLECTION).get();
            for (const doc of usersSnapshot.docs) {
                const userData = doc.data();
                const userId = userData.userId;
                const isSubscribed = await utils.checkSubscription(userId);
                if (isSubscribed) {
                    allUsers.push(userData);
                }
            }
            functions.logger.log("Number of users: ", allUsers.length);

            return allUsers;
        } catch (error) {
            functions.logger.error("Error getting users", error);
        }
    },

    groupFavorites: async (groupingType) => {

        const responseFromGetFavorites = await utils.apiRequest("users/favorites", "GET", null);

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
                                const responseFromGetForecast = await utils.apiRequest(`predict/daily-forecast?site_id=${favorite.place_id}`, "GET", null);
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

    apiRequest: async (url, method, data) => {
        let retryCount = 0;
        let lastError = null;

        while (retryCount < MAX_RETRIES) {
            try {
                const endpoint = `${process.env.PLATFORM_BASE_URL}/api/v2/${url}`;
                const response = await axios({
                    method: method,
                    url: endpoint,
                    data: data,
                    headers: headers,
                });
                return response;
            } catch (error) {
                lastError = error;
                functions.logger.error(`Error making API request for ${url}, Error: ${error}`);
                retryCount++;
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            }
        }

        functions.logger.error("Maximum retries reached for maing API request")
        return {
            success: false,
            error: lastError,
        };
    },

    groupPushNotifications: async (users) => {
        let groupedUsers = {};
        let placeGroupings = [];
        try {
            for (const user of users) {
                let name, location, placeId;

                const responseFromGetFavorites = await utils.apiRequest(`users/favorites/users/${user.userId}`, "GET", null);
                if (responseFromGetFavorites.data.success !== true) {
                    functions.logger.error("Error fetching Favorites", responseFromGetFavorites.data);
                }
                placeGroupings = responseFromGetFavorites.data.favorites;
                if (placeGroupings.length === 0) {
                    const responsefromGetLocationHistories = await utils.apiRequest(`users/locationHistory/users/${user.userId}`, "GET", null);
                    if (responsefromGetLocationHistories.data.success !== true) {
                        functions.logger.error("Error fetching Location Histories", responsefromGetLocationHistories.data);
                    }

                    placeGroupings = responsefromGetLocationHistories.data.location_histories;

                    if (placeGroupings.length === 0) {

                        const responsefromGetSearchHistories = await utils.apiRequest(`users/searchHistory/users/${user.userId}`, "GET", null);
                        if (responsefromGetSearchHistories.data.success !== true) {
                            functions.logger.error("Error fetching Search Histories", responsefromGetSearchHistories.data);
                        }
                        placeGroupings = responsefromGetSearchHistories.data.search_histories;
                        if (placeGroupings.length === 0) {
                            const responsefromGetSites = await utils.apiRequest("devices/sites/summary", "GET", null);
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
                if (!groupedUsers[user.userId]) {
                    groupedUsers[user.userId] = [];
                }
                groupedUsers[user.userId].push({ name, location, placeId });

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