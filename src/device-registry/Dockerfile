FROM node:16 as base

# Create app directory
WORKDIR /usr/src/app

# Install build tools and dependencies
RUN apt-get update && apt-get install -y build-essential python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Increase npm timeout and add verbose logging
RUN npm config set timeout 300000 && npm install --verbose

# Bundle app source
COPY . .

RUN chmod 755 /usr/src/app/bin

EXPOSE 3000

FROM base as dev
CMD [ "npm", "run", "dev" ]

FROM base as staging
CMD [ "npm", "run", "stage" ]

FROM base as production
# In production, we don't need to reinstall - just use what was installed in base
CMD [ "npm", "run", "start" ]