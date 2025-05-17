# Use Node.js 18 LTS as base image
FROM node:18 as base

# Set working directory
WORKDIR /usr/src/app

# Install build tools for native modules
RUN apt-get update && apt-get install -y build-essential python3 && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies (production only)
COPY package*.json ./

# Use npm ci for clean install, only production dependencies
RUN npm ci --only=production

# Copy app source code
COPY . .

# Fix permissions for bin folder
RUN chmod 755 /usr/src/app/bin

# Expose port 3000
EXPOSE 3000

# Development stage
FROM base as dev
# Install all dependencies for development (including devDependencies)
RUN npm install
CMD [ "npm", "run", "dev-mac" ]

# Staging stage
FROM base as staging
CMD [ "npm", "run", "stage" ]

# Production stage
FROM base as production
CMD [ "npm", "run", "start" ]
