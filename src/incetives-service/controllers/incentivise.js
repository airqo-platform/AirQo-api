const Transaction = require('../models/transaction');
const validate = require('../utils/validateAccount');
const MOMO_URL = "https://sandbox.momodeveloper.mtn.com/disbursement";
const fetch = require('node-fetch');

const incentivise = {

    getStatus: (req, res) => {
        res.status(200).send("we are getting the status..");
    },

    getBalance: async (req, res) => {
        const options = {
            method: 'get',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${MOMO_ACCESS_TOKEN}`,
                'Accept': 'application/json'
            }
        };
        let balance = await fetch(`${MOMO_URL}/v1_0/account/balance`, options);

        const messageData = await Response.json();

        // the API frequently returns 201
        if ((response.status !== 200) && (response.status !== 201)) {
            console.error(`Invalid response status ${response.status}.`);
            throw messageData;
        }
        res.status(200).send("we are getting the balance.");

    },

    transfer: (req, res) => {
        res.status(200).send("we are transfering..");
        //check validity of account

        //make the transfer of amount

    },

    callback: (req, res) => {
        res.status(200).send('callback things in the moment');
    }

}

module.exports = incentivise;