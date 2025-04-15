# Apache Superset Docker Image

This repository contains the necessary files to build a Docker image for running a customized instance of Apache Superset, a modern data exploration and visualization platform.

This image uses Python 3.9 as a base and includes common system dependencies needed for connecting Superset to various data sources, along with custom configuration capabilities.

## Features

- **Apache Superset:** Runs the core Apache Superset application.
- **Python 3.9:** Based on the `python:3.9-slim` image.
- **Database Connectivity:** Includes system libraries (`libpq-dev`, `default-libmysqlclient-dev`, `libsasl2-dev`, etc.) required by common Python database drivers (like PostgreSQL, MySQL) often used with Superset. Specific drivers should be added to `requirements.txt`.
- **Custom Python Dependencies:** Installs packages listed in `requirements.txt`.
- **Custom Superset Configuration:** Uses a `superset_config.py` file for detailed Superset settings.
- **Environment Variable Management:** Uses an `.env.docker` file (copied to `/app/.env` inside the container) to manage environment variables, likely loaded by the entrypoint script.
- **Custom Entrypoint:** Includes an `entrypoint.sh` script to handle container initialization (like database migrations via `superset db upgrade`, initialization via `superset init`) and starting the Superset server.
- **Exposed Port:** Exposes the standard Superset port `8088`.

## Prerequisites

- Docker installed ([https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/))
- (Optional but Recommended) Docker Compose ([https://docs.docker.com/compose/install/](https://docs.docker.com/compose/install/))
- The following files must exist in the same directory as the Dockerfile (or be accessible during the build context):
  - `requirements.txt`
  - `superset_config.py`
  - `.env.docker`
  - `entrypoint.sh`

## Project Structure

.
├── Dockerfile # Builds the Superset image
├── requirements.txt # Python dependencies (e.g., DB drivers)
├── superset_config.py # Custom Superset configuration
├── .env.docker # Environment variables for the container
└── entrypoint.sh # Initialization and startup script

## Configuration Files

1.  **`requirements.txt`:**

    - List your required Python packages here, one per line.
    - Crucially, include the necessary database drivers for the data sources you want to connect to (e.g., `psycopg2-binary` for PostgreSQL, `mysqlclient` for MySQL, `pybigquery` for BigQuery).
    - Example:
      ```txt
      psycopg2-binary>=2.8.0,<3.0.0
      pybigquery>=0.10.0,<1.0.0
      # Add other dependencies...
      ```

2.  **`superset_config.py`:**

    - This file overrides default Superset settings. Refer to the [Official Superset Documentation](https://superset.apache.org/docs/installation/configuring-superset) for available configuration options.
    - Common settings include SECRET_KEY (though better set via env var), authentication methods, feature flags, etc.
    - **Note:** The `SECRET_KEY` is essential for Superset to run securely.

3.  **`.env.docker`:**

    - This file defines environment variables used by the container, likely loaded by `entrypoint.sh`. It will be copied to `/app/.env` inside the container.
    - **Critical Variables:**
      - `SQLALCHEMY_DATABASE_URI`: Specifies the connection string for Superset's metadata database (e.g., `postgresql+psycopg2://user:pass@host:port/dbname`). This is **required** for `superset db upgrade` and `superset init` in the entrypoint.
      - `SECRET_KEY`: A long, random, secret string used for session signing.
      - `SUPERSET_SECRET_KEY`: Often used as an alias or replacement for `SECRET_KEY`. Check your `superset_config.py` or entrypoint logic.
      - Other variables needed by your `superset_config.py` or entrypoint.
    - Example:
      ```env
      # Contents of .env.docker
      SQLALCHEMY_DATABASE_URI=postgresql+psycopg2://superset_user:password123@db_host:5432/superset_metadata
      SECRET_KEY=_Set_A_Very_Long_Random_Secret_Key_Here_!_#
      # Add other env vars as needed
      ```

4.  **`entrypoint.sh`:**
    - This shell script controls the container's startup sequence.
    - Based on the Dockerfile, it likely:
      - Sources `/app/.env` to load environment variables.
      - Runs `superset db upgrade` to apply database migrations.
      - Runs `superset init` to initialize roles/permissions (if needed).
      - Starts the Superset web server using `superset run -h 0.0.0.0 -p 8088`.
    - Ensure this script has execute permissions (`chmod +x entrypoint.sh` before building or use `RUN chmod +x` in Dockerfile).

## Building the Image

Navigate to the directory containing the Dockerfile and other configuration files, then run:

```bash
docker build -t your-custom-superset:latest .
```
