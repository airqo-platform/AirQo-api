const constants = require("./constants");
const momo = require("mtn-momo");
const { Disbursements } = momo.create({
  callbackHost: constants.MTN_MOMO_DISBURSEMENTS_CALLBACK_HOST,
});

const disbursements = Disbursements({
  userSecret: constants.MTN_MOMO_DISBURSEMENTS_USER_SECRET,
  userId: constants.MTN_MOMO_DISBURSEMENTS_USER_ID,
  primaryKey: constants.MTN_MOMO_DISBURSEMENTS_PRIMARY_KEY,
});

module.exports = disbursements;
