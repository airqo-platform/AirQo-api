/**
 * Responds to any HTTP request.
 *
 * @param {!express:Request} req HTTP request context.
 * @param {!express:Response} res HTTP response context.
 */

const Google = require('googleapis');
const BUCKET = 'fivetran-auth-bucket';

const fetch = require('node-fetch');

const dotenv = require('dotenv');
dotenv.config();

/**
 * @param {!Object} req Cloud Function request context.
 * @param {!Object} res Cloud Function response context.
 */


exports.handler = (req, res) => {
    var accessToken = getAccessToken(req.get('Authorization'));
    var oauth = new Google.auth.OAuth2();
    oauth.setCredentials({ access_token: accessToken });

    var permission = 'storage.buckets.get';
    var gcs = Google.storage('v1');
    gcs.buckets.testIamPermissions(
        { bucket: BUCKET, permissions: [permission], auth: oauth }, {},
        function (err, response) {
            if (response && response['permissions'] && response['permissions'].includes(permission)) {
                if (req.body.state === undefined) {
                    res.status(400).send('No state is defined!');
                }

                if (req.body.secrets === undefined) {
                    res.status(400).send('No secrets is defined!');
                }

                res.header("Content-Type", "application/json");
                res.status(200).send(update(req.body.state, req.body.secrets));
            } else {
                res.status(403).send("The request is forbidden.");
            }
        });
};


function update(state, secrets) {
    // Fetch records using api calls
    let [insertTransactions, deleteTransactions, newTransactionsCursor] = apiResponse(state, secrets);

    // Populate records and state
    return ({
        state: {
            transactionsCursor: newTransactionsCursor
        },
        insert: {
            transactions: insertTransactions
        },
        delete: {
            transactions: deleteTransactions
        },
        schema: {
            transactions: {
                primary_key: ['order_id', 'date']
            }
        },
        hasMore: false
    });
}


function apiResponse(state, secrets) {
    var insertTransactions = [
        { "date": '2017-12-31T05:12:05Z', "order_id": 1001, "amount": '$1200', "discount": '$12' },
        { "date": '2017-12-31T06:12:04Z', "order_id": 1001, "amount": '$1200', "discount": '$12' },
    ];

    var deleteTransactions = [
        { "date": '2017-12-31T05:12:05Z', "order_id": 1000, "amount": '$1200', "discount": '$12' },
        { "date": '2017-12-31T06:12:04Z', "order_id": 1000, "amount": '$1200', "discount": '$12' },
    ];

    return [insertTransactions, deleteTransactions, '2018-01-01T00:00:00Z'];
}

function getAccessToken(header) {
    if (header) {
        var match = header.match(/^Bearer\s+([^\s]+)$/);
        if (match) {
            return match[1];
        }
    }

    return null;
}

function getFeeds(channel_id) {
    return `https://api.thingspeak.com/channels/${channel_id}/feeds.json`
}

async function generateFeedsTable(channel_id) {
    //get all the channel IDs and store them in an array
    //use those channel IDs to get the respective feeds

    try {
        const response = await fetch(getFeeds(channel_id));
        const responseObject = await response.json();

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

