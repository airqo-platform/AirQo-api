# Firebase Authentication Functions

This Folder contains Firebase Cloud Functions related to users for the AirQo project.

## Table of Contents

- [Functions Overview](#functions-overview)
- [Prerequisites](#prerequisites)
- [Function Descriptions](#function-descriptions)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Functions Overview

This Firebase Functions folder handles various user-related tasks, including sending confirmation emails, processing account deletions, and managing email notification preferences. The functions are built using Node.js and are deployed to Firebase Cloud Functions.

## Prerequisites

Before you can use these Firebase Functions, make sure you have the following installed:

- [Node.js](https://nodejs.org/) (Recommended version: 14.x)
- [Firebase CLI](https://firebase.google.com/docs/cli)

You'll also need to set up a Firebase project and configure environment variables using the Firebase CLI.

## Function Descriptions

1. **confirmAccountDeletionMobile**:  
   This function sends a confirmation email for account deletion. It requires an email address, and it sends an email with a confirmation link to the user.

2. **sendWelcomeEmail**:  
   This function sends a welcome email to new users. It is triggered when a new user is created and sends a personalized welcome email.

3. **sendWelcomeNotification**:  
   This function sends a welcome notification to new users. It adds a welcome notification to the user's collection.

4. **deleteUserAccount**:  
   This function sends a goodbye email to users when their account is deleted.

5. **sendEmailNotifications**:  
   This function sends email notifications to users with their favorite locations' updates. It retrieves user preferences and sends emails accordingly.

6. **emailNotifsUnsubscribe**:  
   This function handles email notification unsubscription requests. Users can unsubscribe from email notifications using this function.

7. **emailNotifsSubscribe**:  
   This function handles email notification subscription requests. Users can subscribe to email notifications using this function.

## Usage

To use these Firebase Functions, deploy them to your Firebase project using the Firebase CLI. You can trigger these functions based on various Firebase events such as user creation or HTTP requests.

Refer to the Firebase documentation for more details on deploying and triggering Firebase Functions.

## Contributing

Feel free to contribute to this repository by submitting pull requests or raising issues. Your contributions are welcome!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

