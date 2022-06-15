# Inherit from the Python Docker image
FROM python:3.8

# Change the working directory
WORKDIR /app/

# Copy the source code to app folder
COPY . /app/

# Installing requirements
RUN pip install -r requirements.txt

# Run the application
CMD ["streamlit", "run", "network-dashboard.py"]