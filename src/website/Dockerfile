# Multi-stage build for maximum optimization
# Stage 1: Build dependencies
FROM python:3.11-alpine AS builder

# Build args for optimization
ARG PYTHONDONTWRITEBYTECODE=1
ARG PYTHONUNBUFFERED=1

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=${PYTHONDONTWRITEBYTECODE} \
    PYTHONUNBUFFERED=${PYTHONUNBUFFERED} \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies (minimal set)
RUN apk add --no-cache --virtual .build-deps \
    gcc \
    musl-dev \
    postgresql-dev \
    linux-headers \
    && pip install --upgrade pip

# Copy requirements first for better caching
COPY requirements.txt /tmp/
RUN pip install --user --no-warn-script-location -r /tmp/requirements.txt \
    && find /root/.local -type d -name "__pycache__" -exec rm -rf {} + || true

# Stage 2: Production image (Alpine-based)
FROM python:3.11-alpine AS production

# Runtime environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/home/appuser/.local/bin:$PATH" \
    PYTHONPATH="/home/appuser/.local/lib/python3.11/site-packages"

# Install minimal runtime dependencies
RUN apk add --no-cache \
    libpq \
    wget \
    && addgroup -g 1000 appgroup \
    && adduser -u 1000 -D -G appgroup appuser

# Set working directory
WORKDIR /app

# Copy Python packages from builder to appuser home directory
COPY --from=builder --chown=appuser:appgroup /root/.local /home/appuser/.local

# Copy requirements file for reference
COPY --chown=appuser:appgroup requirements.txt .

# Copy application code
COPY --chown=appuser:appgroup . .

# Create directories and fix permissions in single layer
RUN mkdir -p /app/staticfiles /app/logs \
    && find /app -name "*.pyc" -delete \
    && find /app -name "__pycache__" -type d -exec rm -rf {} + || true \
    && sed -i 's/\r$//' /app/entrypoint.sh \
    && chmod +x /app/entrypoint.sh \
    && chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Optimized health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=2 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8000/website/healthcheck/ || exit 1

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
