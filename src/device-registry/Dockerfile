FROM node:12 as base

# Create app directory
WORKDIR /usr/src/app

RUN chmod 777 /usr/src/app
# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

RUN npm install

# Bundle app source
COPY . .

RUN chmod 777 /usr/src/app/bin/www

EXPOSE 3000

FROM base as dev
CMD [ "npm", "run", "dev-mac" ]

FROM base as staging
CMD [ "npm", "run", "stage-mac" ]

FROM base as production

RUN npm ci --only=production
CMD [ "npm", "run","start" ] 