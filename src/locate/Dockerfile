# Comments in Dockerfiles
FROM python:3.7

# Update and install dependencies
RUN apt-get update

# Add code
ADD . /opt/webapp/

# Set the working directory
WORKDIR /opt/webapp
RUN pip install -r requirements.txt 

# Set environment variables
ENV FLASK_APP=app.py

# Expose the application's port
EXPOSE 4001

# Run the application
CMD ["flask", "run", "--host=0.0.0.0"]