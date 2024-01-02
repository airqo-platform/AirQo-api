const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const xente = {
  XENTE_PAYMENT_PROVIDER: process.env.XENTE_PAYMENT_PROVIDER,
  XENTE_METADATA: process.env.XENTE_METADATA,
  XENTE_BATCH_ID: process.env.XENTE_BATCH_ID,
  XENTE_REQUEST_ID: process.env.XENTE_REQUEST_ID,
  XENTE_MEMO: process.env.XENTE_MEMO,
  XENTE_CHANNEL_ID: process.env.XENTE_CHANNEL_ID,
  XENTE_CUSTOMER_ID: process.env.XENTE_CUSTOMER_ID,
  XENTE_CUSTOMER_PHONE: process.env.XENTE_CUSTOMER_PHONE,
  XENTE_CUSTOMER_EMAIL: process.env.XENTE_CUSTOMER_EMAIL,
};
module.exports = xente;
