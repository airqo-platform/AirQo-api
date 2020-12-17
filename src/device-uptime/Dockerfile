# Inherit from the Python Docker image
FROM python:3.7-slim

# Copy the source code to app folder
COPY . /app/
# Change the working directory
WORKDIR /app/

# Install the Flask package via pip
RUN pip install -r requirements.txt
# Set "python" as the entry point
# Set environment variables
ENV FLASK_ENV=production
ENV GOOGLE_APPLICATION_CREDENTIALS=AirQo-e37846081569.json

# Expose the application's port, default is 5000 for python flask
EXPOSE 5000

# Run the application
CMD ["python", "app.py", "--tenant=airqo"]