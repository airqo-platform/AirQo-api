# Incentives API

The Incentives API is a service that facilitates the management of hosts' data and the loading of data bundles onto devices' SIM cards. It allows organizations to efficiently manage data provisioning.

## The Use Cases

- Adding and updating hosts' data.
- Loading data bundles onto devices' SIM cards.
- Checking the remaining balance on a device's SIM card.

## Base URL

The base URL for accessing the Incentives API is:
https://staging-platform.airqo.net/api/v2/incentives

## Authentication

The Incentives API requires authentication using an API token. Include the API token as a query parameter as follows:

{BASE_URL}/{PATH}?token={TOKEN}

## Endpoints

### Hosts' Data Management

#### Add Host Data

- Endpoint: `/hosts/{hostId}`
- Method: POST
- Description: Adds or updates hosts' data.
- Request Body: Host Details
- Response: Status

### Host Payments

#### Send Money to Host

- Endpoint: `/hosts/{hostId}/payments`
- Method: POST
- Description: Sends money to a host's mobile money account.
- Request Body: Amount, Mobile Money Account, Payment Details
- Response: Transaction ID, Status

#### Add Money to Organizational Account

- Endpoint: `/accounts/payments`
- Method: POST
- Description: Adds money to the organizational account for host payments.
- Request Body: Amount, Payment Details
- Response: Transaction ID, Status

#### Receive Money from Host

- Endpoint: `/accounts/receive`
- Method: POST
- Description: Receives money from a host's mobile money account into the organizational account.
- Request Body: Amount, Mobile Money Account, Payment Details
- Response: Transaction ID, Status

#### Get Transaction Details

- Endpoint: `/payments/{transactionId}`
- Method: GET
- Description: Retrieves transaction details by transaction ID.
- Response: Transaction Details

### SIM Card Data Loading

#### Load Data Bundle

- Endpoint: `/devices/{deviceId}/data`
- Method: POST
- Description: Loads a data bundle onto a device's SIM card.
- Request Body: Data Bundle Details
- Response: Transaction ID, Status

#### Check Remaining Balance

- Endpoint: `/devices/{deviceId}/balance`
- Method: GET
- Description: Retrieves the remaining balance on a device's SIM card.
- Response: Balance Amount

## Error Handling

The Incentives API follows standard HTTP status codes for indicating the success or failure of requests. In case of errors, appropriate error messages will be provided in the response.

## Privacy Considerations

The API handles sensitive data such as payment details and mobile money accounts. Appropriate security measures are in place to ensure the confidentiality and integrity of the data.

## Limitations and Fair Usage

The API has usage limits and fair usage policies in place to prevent abuse and maintain a high-quality service.

**Update:**
The scope of the service is now shifting towards IoT sim card management as the main focus.
