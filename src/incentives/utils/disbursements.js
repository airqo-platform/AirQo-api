
// Import the module
const { useUserProvisioning, useDisbursements } = require('mtn-momo');

const subscriptionKey = 'DISBURSEMENTS_PRIMARY_KEY';

// (sandbox/development environment only) Provision/create a user and api key
const sandboxUserInfo = await useUserProvisioning.createApiUserAndKey({
  subscriptionKey: subscriptionKey,
  providerCallbackHost: 'PROVIDER_CALLBACK_HOST'
});
const { userId, apiKey, targetEnvironment } = sandboxUserInfo;

// Initialize the wrapper
const disbursements = useDisbursements({
  subscriptionKey,
  apiKey,
  userId,
  targetEnvironment
});

/* Disbursements API */

// (optional) Get an access token
const token = await disbursements.getToken();
const { token_type, access_token, expires_in } = token;

// Check if an account is active. Returns a boolean value
const isActive = await disbursements.isAccountActive({
  accountHolderIdType: 'msisdn',
  accountHolderId: 'PHONE_NUMBER'
});

// Submit a request for payment
const paymentOptions = {
  amount: 15000,
  currency: 'EUR',
  externalId: '123456789',
  payee: {
    partyIdType: 'msisdn',
    partyId: 'PHONE_NUMBER'
  },
  payerMessage: 'message',
  payeeNote: 'note'
};
const transactionId = await disbursements.useiate({
  callbackUrl: 'http://test1.com',
  paymentOptions: paymentOptions
});

// Check the status of a request for payment
const transaction = await disbursements.fetchTransaction(transactionId);
const {
  amount,
  currency,
  financialTransactionId,
  externalId,
  payee: {
    partyIdType,
    partyId
  },
  status: 'SUCCESSFUL|FAILED|PENDING',
  reason: {
    code,
    message
  }
} = transaction;

// Check my account balance
const accountBalance = await disbursements.fetchAccountBalance();
const { currency, availableBalance } = accountBalance;

/* End Disbursements API */

