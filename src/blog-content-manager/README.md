# Blog Content Manager.

This is a comprehensive microservice designed to create, manage, and share content efficiently. It provides a robust set of features for both content creators and readers, ensuring a seamless blogging experience.

## Features

### 1\. Blog Post Creation and Management

- Create, edit, and delete blog posts
- Rich text editor for content creation
- Draft saving and scheduling posts

### 2\. Commenting System

- Add, edit, and delete comments
- Nested replies
- Comment moderation tools

### 3\. Category and Tag Management

- Organize posts with categories and tags
- Create, edit, and delete categories and tags
- Filter posts by category or tag

### 4\. Search Functionality

- Full-text search across all blog posts
- Advanced filtering options

### 5\. User Interaction

- Like and share posts
- Follow authors or topics
- Personalized content recommendations

### 6\. Content Moderation

- Review and approve/reject posts and comments
- Flagging system for inappropriate content

### 7\. Analytics and Reporting

- View post performance metrics
- User engagement analytics
- Custom report generation

### 8\. RSS Feed Generation

- Automatic RSS feed for blog posts
- Category-specific feeds

## Technical Stack

- Backend: Node.js with Express.js
- Database: MongoDB
- Authentication: AirQo Tokens
- Search: Elasticsearch
- Caching: Redis

## Getting Started

1.  Clone the repository

    ```bash
    git clone https://github.com/airqo-platform/AirQo-api.git
    ```

2.  Install dependencies

    ```bash
    cd src/blog-content-manager npm install
    ```

3.  Set up environment variables

    ```bash
    cp .env.example .env # Edit .env with your configuration
    ```

4.  Start the server

    ```
    npm run dev
    ```

## API Documentation

API documentation is available at `/api/blogs/api-docs` when running the server locally.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
