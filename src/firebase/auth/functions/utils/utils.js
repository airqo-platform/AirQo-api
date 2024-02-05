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
                        const isSubscribedToEmailNotifs = userDoc.data().isSubscribedToEmailNotifs;

                        if (userEmail && isSubscribedToEmailNotifs !== false) {
                            const { name, location } = favorite;

                            if (!groupedFavorites[userID]) {
                                groupedFavorites[userID] = [];
                            }

                            if (groupingType === "forecast") {
                                const responseFromGetForecast = await axios.get(`${process.env.PLATFORM_BASE_URL}/api/v2/predict/daily-forecast?site_id=${favorite.place_id}`,
                                    { headers: headers });
                                if (responseFromGetForecast.status !== 200) {
                                    functions.logger.log("Error getting Forecast", responseFromGetForecast);
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
                    functions.logger.log("Error grouping favorites", error);
                    return {
                        success: false,
                        error: error,
                    };
                }
            }

        }
        else {
            functions.logger.log("Error fetching Favorites", responseFromGetFavorites);
            return {
                success: false,
                error: responseFromGetFavorites,
            };
        }
        return groupedFavorites;
    },
};

module.exports = utils;