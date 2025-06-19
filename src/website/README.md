# AirQo Website Backend

This is the backend API service for the AirQo website built with Django 5.1.4. It provides API endpoints for managing content and data for various sections of the AirQo website.

## Technology Stack

- **Framework**: Django 5.1.4
- **API Framework**: Django REST Framework 3.15.2
- **Database**: PostgreSQL (with dj-database-url for configuration)
- **Media Storage**: Cloudinary
- **Documentation**: Swagger/OpenAPI (drf-yasg)
- **Rich Text Editor**: Django Quill Editor
- **CORS**: django-cors-headers
- **Static Files**: WhiteNoise
- **Environment Variables**: python-dotenv

## Features

The backend consists of multiple Django apps that handle different sections of the website:

1. **AfricanCities**: Manage African cities data and content
2. **Board**: Board members management
3. **Career**: Career/Job postings and applications
4. **CleanAir**: Clean air initiatives and forum events
5. **Event**: Event management system
6. **ExternalTeams**: External team members management
7. **FAQs**: Frequently asked questions
8. **Highlights**: Website highlights/features
9. **Impact**: Impact metrics and stories
10. **Partners**: Partner organizations management
11. **Press**: Press releases and media content
12. **Publications**: Research publications and resources
13. **Team**: Internal team management

## Installation

1. Clone the repository
2. Create a virtual environment:

   ```bash
   python -m venv venv
   source venv/bin/activate  # Linux/Mac
   # or
   venv\Scripts\activate  # Windows
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Create `.env` file with required environment variables:

   ```env
   SECRET_KEY=your-secret-key
   DEBUG=True
   DATABASE_URL=your-database-url
   ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com

   # Cloudinary configuration
   CLOUDINARY_CLOUD_NAME=your-cloud-name
   CLOUDINARY_API_KEY=your-api-key
   CLOUDINARY_API_SECRET=your-api-secret

   # CORS Configuration
   CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
   CSRF_TRUSTED_ORIGINS=http://localhost:3000,https://your-frontend-domain.com
   ```

5. Run migrations:

   ```bash
   python manage.py migrate
   ```

6. Create a superuser:

   ```bash
   python manage.py createsuperuser
   ```

7. Collect static files:

   ```bash
   python manage.py collectstatic
   ```

8. Run the development server:
   ```bash
   python manage.py runserver
   ```

## API Documentation

The API documentation is available at:

- Swagger UI: `/website/swagger/`
- ReDoc: `/website/redoc/`

## Admin Interface

The Django admin interface is available at `/website/admin/`. Use your superuser credentials to log in.

## Project Structure

```
website/
├── apps/                    # Django applications
│   ├── africancities/      # African cities management
│   ├── board/              # Board members management
│   ├── career/             # Career/Jobs management
│   ├── cleanair/           # Clean air initiatives
│   ├── event/              # Event management
│   ├── externalteams/      # External teams
│   ├── faqs/               # FAQs management
│   ├── highlights/         # Website highlights
│   ├── impact/             # Impact metrics
│   ├── partners/           # Partners management
│   ├── press/             # Press releases
│   ├── publications/      # Publications management
│   └── team/              # Team management
├── core/                   # Project settings
├── static/                # Static files
├── staticfiles/           # Collected static files
├── templates/             # HTML templates
├── utils/                 # Utility functions
├── manage.py
├── requirements.txt
└── .env
```

## Deployment

The project uses WhiteNoise for serving static files and Cloudinary for media storage, making it suitable for deployment on platforms like Heroku or similar services.

For production deployment:

1. Set DEBUG=False in .env
2. Configure proper ALLOWED_HOSTS
3. Set up proper database credentials
4. Configure CSRF and CORS settings
5. Set up proper Cloudinary credentials

## Security

- CSRF protection is enabled
- CORS is configured to allow only specific origins
- Session cookie security is tied to DEBUG setting
- Cloudinary secure URLs are enforced

## Logging

Comprehensive logging is configured with different handlers:

- Console logging
- File logging (django.log)
- Error logging (django_errors.log)

Each app has its own logger configuration for better debugging and monitoring.

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Write/update tests if necessary
4. Create a pull request
