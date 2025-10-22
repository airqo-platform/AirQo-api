# Authentication Service..

This authentication microservice is a crucial component of our application's security infrastructure. It handles user authentication & authorization, ensuring that only authenticated users can access protected resources.

## Features

- User Registration: This allows new users to create an account by providing their credentials & completing the registration process.
- User Login: Provides a secure login mechanism for users to authenticate themselves and obtain an access token for subsequent requests.
- Password Management: Offers password reset and change functionalities to maintain user account security.
- Token-based Authentication: Utilizes JSON Web Tokens (JWT) for stateless authentication, allowing users to access protected endpoints with a valid token.
- Role-based Authorization: Implements role-based access control (RBAC) to define granular permissions and restrict certain actions to authorized roles.
- Token Validation: Verifies the authenticity and validity of tokens during authentication and authorization processes.
- User Profile Management: Allows users to update their profile information, including personal details and preferences.
- Security Measures: Implements industry-standard security practices, such as password hashing and encryption, to protect user data and prevent unauthorized access to AirQo Analytics.

## Folder Structure

```
.
├── bin
│   └── jobs
├── config
│   ├── environments
│   ├── global
│   └── images
├── controllers
├── middleware
├── models
├── routes
│   ├── v1
│   └── v2
├── utils
│   ├── common
│   ├── scripts
│   └── shared
└── validators
```

For detailed information on the project's code structure and naming conventions, please refer to the [CODEBASE_STRUCTURE](CODEBASE_STRUCTURE.md).

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm (or yarn)
- MongoDB (local or remote; configure `DB_URL` if remote)
- Redis
- Mailchimp
- Google Cloud
- Paddle

### Installation

1.  Clone the repository: `git clone https://github.com/airqo-platform/AirQo-api.git`
2.  Navigate to the project directory: `cd auth-service`
3.  Install dependencies: `npm install`

### Running Locally

1.  Create a `.env` file in the project root (see `.env.example` if available or create your own) and set the environment variables appropriately.
2.  Start the development server: `npm run dev`

### Running in Production (Docker)

1.  Build the Docker image: `docker build -t auth-service .`
2.  Run the Docker container (setting `NODE_ENV`): `docker run -d -p 3000:3000 -e NODE_ENV=production auth-service`

## Testing

Run tests using: `npm test`

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md)

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

[MIT](LICENSE)
