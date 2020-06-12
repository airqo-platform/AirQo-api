const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channels = require("../models/Channel");
const Feed = require("../models/Feed");
const axios = require("axios");
const redis = require("../config/redis");

async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
        await callback(array[index], index, array);
    }
}

const data = {
    getLocationDetails: (req, res) => {
        /*** we can check the entry age of this field
         * and then be able to send alerts accordingly
         */
        let lat = req.body.lat;
        let lon = req.body.lon;
    },

    storeChannels: async(req, res) => {
        const query = req.query.query.trim();
        const api_url_channels = `https://api.thingspeak.com/channels.json?api_key=${process.env.TS_API_KEY}`;

        return redis.get(`channels:${query}`, (err, result) => {
            // If that key exist in Redis store
            if (result) {
                const resultJSON = JSON.parse(result);
                return res.status(200).json(resultJSON);
            } else {
                // Key does not exist in Redis store
                return axios
                    .get(api_url_channels)
                    .then((response) => {
                        const responseJSON = response.data;
                        // Save the API response in Redis store
                        redis.setex(
                            `channels:${query}`,
                            3600,
                            JSON.stringify({ source: "Redis Cache", ...responseJSON })
                        );
                        // Send JSON response to redis
                        return res
                            .status(200)
                            .json({ source: "Channels API", ...responseJSON });
                    })
                    .catch((err) => {
                        return res.json(err);
                    });
            }
        });
    },
    storeFeeds: async(req, res) => {
        const api_url = `https://api.thingspeak.com/channels/${req.params.ch_id}/feeds.json`;
        const fetch_response = await fetch(api_url);
        const json = await fetch_response.json();
        res.status(200).send(json);
    },

    getLastEntry: async(req, res) => {
        try {
            const api_url = `https://api.thingspeak.com/channels/${req.params.ch_id}/feeds.json`;
            let fetch_response = await fetch(api_url);
            let json = await fetch_response.json();
            let response = {};
            response.metadata = json.channel;
            let entry = json.channel.last_entry_id;
            let feed = await json.feeds.filter((obj) => {
                return obj.entry_id === entry;
            });
            response.feed = feed[0];
            res.status(200).json(response);
        } catch (e) {
            res.status(501).send(e.message);
        }
    },

    hourly: async(req, res) => {
        try {
            const api_url = `https://us-central1-airqo-250220.cloudfunctions.net/get_hourly_channel_data?channel_id=${req.params.ch_id}`;
            let fetch_response = await fetch(api_url);
            let json = await fetch_response.json();
            res.status(200).send(json);
        } catch (error) {
            res.status(501).send(error.message);
        }
    },

    storeAlerts: async(req, res) => {
        try {} catch (error) {}
    },
};

module.exports = data;