'use strict';
const fetch = require('node-fetch');
const constants = require('../config/constants');

async function token() {
    const url = `${constants.MOMO_URL_DISBURSEMENTS}/token`;

    const auth_string = `baalmart@gmail.com ${process.env.DISBURSEMENTS_MOMO_PRIMARY_KEY}`;
    let buff = new Buffer(auth_string);
    let auth_b64 = buff.toString('base64');

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': auth_b64,
            'Accept': 'application/json',
            'Ocp-Apim-Subscription-Key': `${process.env.DISBURSEMENTS_MOMO_PRIMARY_KEY}`
        }
    };

    try {
        let balance = await fetch(`${constants.MOMO_URL_DISBURSEMENTS}/v1_0/account/balance`, options);
        const balanceJSON = await balance.json();
        return balanceJSON;
    }
    catch (e) {
        return e.message;
    }

}

module.exports = token();
