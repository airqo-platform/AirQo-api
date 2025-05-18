FROM node:14 as base

# Create app directory
WORKDIR /usr/src/app

# Install build tools and dependencies
RUN apt-get update && \
    apt-get install -y build-essential python3 make g++ curl git && \
    rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Debug: Check Node and npm versions
RUN node --version && npm --version

# Set npm configurations for troubleshooting
RUN npm config set loglevel verbose && \
    npm config set timeout 600000 && \
    npm config set unsafe-perm true && \
    npm config set registry https://registry.npmjs.org/

# Try to clean npm cache first
RUN npm cache clean --force

# Install dependencies with fallback strategies
RUN npm install || \
    (echo "Retrying with legacy peer deps..." && npm install --legacy-peer-deps) || \
    (echo "Retrying with force..." && npm install --force)

# Bundle app source
COPY . .

RUN chmod 755 /usr/src/app/bin

EXPOSE 3000

FROM base as dev
CMD [ "npm", "run", "dev" ]

FROM base as staging
CMD [ "npm", "run", "stage" ]

FROM base as production
CMD [ "npm", "run", "start" ]