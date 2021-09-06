FROM python:3.8-slim-buster

# Copy the source code to app folder
COPY . /app/

# Change the working directory
WORKDIR /app/

# Install and cache requirements via pip,
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

# Run the application
CMD ["python", "main.py"]