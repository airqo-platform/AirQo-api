const dotenv = require('dotenv');
dotenv.config();

const fetch = require('node-fetch');

function getFeeds(channel_id) {
    return `https://api.thingspeak.com/channels/${channel_id}/feeds.json`
}

async function generateFeedsTable(channel_id) {
    //get all the channel IDs and store them in an array
    //use those channel IDs to get the respective feeds

    try {
        const feedsTable = [];
        const response = await fetch(getFeeds(channel_id));
        const responseObject = await response.json();
        const feeds = await responseObject.feeds;

        //loop through the array and add channel ID to every feed of the arrray.
        feeds.forEach(function (element) {
            element.channel_id = channel_id;
        });

        console.log(await feeds);
        //store each channel's json feed into a database or cloud storage solution

        //continously update the database tables or cloud storage accordingly.

    }
    catch (e) {
        res.status(501).send(e.message);
    }

}

function getChannelsTable() {
    return `https://api.thingspeak.com/channels.json?api_key=${AUTH_KEY}`
}

module.exports = generateFeedsTable(630833);

