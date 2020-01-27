const Transaction = require('../models/transaction');
const validate = require('../utils/validateAccount');
const fetch = require('node-fetch');
const constants = require('../config/constants');
const token = require('../utils/reimbursements-token');

const incentivize = {

    getStatus: (req, res) => {
        res.status(200).send("we are getting the status");
    },

    getBalance: async (req, res) => {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Ocp-Apim-Subscription-Key': `${process.env.DISBURSEMENTS_MOMO_PRIMARY_KEY}`,
                'X-Target-Environment': ''
            }
        };
        try {
            const response = await fetch(`${constants.MOMO_URL_DISBURSEMENTS}/v1_0/account/balance`,
                options);
            let json = await response.json();
            res.status(200).send(json);
        }
        catch (e) {
            res.status(500).send(e.message);
        }

    },

    callback: (req, res) => {
        res.status(200).send('callback things in the moment');
    },

    data: (req, res) => {
        const deviceId = req.params.id;
        const option = req.params.option;
        //check the existence of the devices
        //assumption is that this device was registered with a phone number.
        //get the device' phone number and purchase data for it accordingly using the payment option selected.
        //assumption is that we are using the merchant account for the device.
        //send a success message about this purchase accordingly.
    },

    momo: async (req, res) => {
        let deviceId = req.body.id;
        let phone = req.body.phone;
        let option = req.body.option;
        let amount = req.body.amount;
        let reference = req.body.ref

        //check validity of the device being added.
        //obtain the phone number of the device that was registered with that device
        //validate if the phone number is active and able to receive funds.
        //then send mobile money to that number accordingly.
        const body = {
            "amount": amount,
            "currency": "UGX",
            "externalId": "",
            "payee": {
                "partyIdType": "MSISDN",
                "partyId": phone
            },
            "payerMessage": "AirQo funds transfer",
            "payeeNote": ""
        };
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'Ocp-Apim-Subscription-Key': `${process.env.DISBURSEMENTS_MOMO_PRIMARY_KEY}`,
                'X-Target-Environment': 'sandbox',
                'X-Reference-id': `${reference}`,
            },
            body: body
        };

        fetch(`${constants.MOMO_URL_DISBURSEMENTS}/v1_0/transfer`,
            options)
            .then(res => res.json)
            .then(json => res.status(200).send(json))
            .catch(error => res.status(500).send(error.message))
    }
}

module.exports = incentivize;