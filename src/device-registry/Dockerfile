FROM node:18 as base

# Create app directory
WORKDIR /usr/src/app

# Install build tools for native modules
RUN apt-get update && apt-get install -y build-essential python3 && rm -rf /var/lib/apt/lists/*

RUN chmod 777 /usr/src/app
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

RUN chmod 755 /usr/src/app/bin

EXPOSE 3000

FROM base as dev
CMD [ "npm", "run", "dev-mac" ]

FROM base as staging
CMD [ "npm", "run", "stage" ]

FROM base as production

RUN npm ci --only=production
CMD [ "npm", "run","start" ] 