const { logElement, logObject, logText } = require("../utils/log");
const { useUserProvisioning, useDisbursements } = require("mtn-momo");
const mtnMOMO = require("mtn-momo");

const constants = require("../config/constants");

const disburseMoney = async () => {
  try {
    const subscriptionKey = constants.DISBURSEMENTS_MOMO_PRIMARY_KEY;

    // (sandbox/development environment only) Provision/create a user and api key
    logObject("useUserProvisioning", useUserProvisioning);
    logObject("useDisbursements", useDisbursements);
    logObject("mtnMOMO", mtnMOMO);

    const sandboxUserInfo = await useUserProvisioning.createApiUserAndKey({
      subscriptionKey: subscriptionKey,
      providerCallbackHost: constants.PROVIDER_CALLBACK_HOST,
    });
    const { userId, apiKey, targetEnvironment } = sandboxUserInfo;

    // Initialize the wrapper
    const disbursements = useDisbursements({
      subscriptionKey,
      apiKey,
      userId,
      targetEnvironment,
    });

    /* Disbursements API */

    // (optional) Get an access token
    const token = await disbursements.getToken();
    const { token_type, access_token, expires_in } = token;

    logElement("token", token);

    /**
     * in case we have a group of accounts here, we shall loop through them
     * accordingly from here---going onwwards
     */

    // Check if an account is active. Returns a boolean value
    const isActive = await disbursements.isAccountActive({
      accountHolderIdType: "msisdn",
      accountHolderId: constants.PHONE_NUMBER,
    });

    logElement("isActive", isActive);
    // Submit a request for payment
    const paymentOptions = {
      amount: 15000,
      currency: "EUR",
      externalId: "123456789",
      payee: {
        partyIdType: "msisdn",
        partyId: constants.PHONE_NUMBER,
      },
      payerMessage: "you have received money from AirQo",
      payeeNote: "you have received money from AirQo",
    };

    const transactionId = await disbursements.useiate({
      callbackUrl: `http://${constants.PROVIDER_CALLBACK_HOST}`,
      paymentOptions,
    });

    logElement("the transactionId", transactionId);

    // Check the status of a request for payment
    const transaction = await disbursements.fetchTransaction(transactionId);
    const {
      amount,
      currency,
      financialTransactionId,
      externalId,
      payee: { partyIdType, partyId },
      status,
      reason: { code, message },
    } = transaction;

    logObject("the transaction", transation);

    // Check my account balance
    const accountBalance = await disbursements.fetchAccountBalance();
    // const { currency, availableBalance } = accountBalance;

    return { transaction, accountBalance, success: true, message: "all good" };
  } catch (error) {
    return {
      message: " all bad",
      error: error.message,
      success: false,
    };
  }

  /* End Disbursements API */
};

module.exports = disburseMoney;
