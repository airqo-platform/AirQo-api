# # Comments in Dockerfiles
# FROM python:3.7

# # Update and install dependencies
# RUN apt-get update

# # Add code
# ADD . /opt/webapp/

# # Set the working directory
# WORKDIR /opt/webapp
# RUN pip install -r requirements.txt 

# # Set environment variables
# ENV FLASK_APP=app.py

# # Expose the application's port
# EXPOSE 4000

# # Run the application
# CMD ["flask", "run", "--host=0.0.0.0"]

# Use the official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.7-slim

# Copy local code to the container image.
ENV APP_HOME /app

# define work directory
WORKDIR $APP_HOME

# copy code to work direction
COPY . ./
# install production dependencies
RUN pip install -r requirements.txt

# Set environment variables
ENV FLASK_APP=app.py

# Expose application port to container
EXPOSE 4000

# run execuation command 
ENTRYPOINT ["flask", "run", "--host", "0.0.0.0"]