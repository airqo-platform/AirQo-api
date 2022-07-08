# syntax=docker/dockerfile:1
FROM node:14 as base
WORKDIR /app
COPY package*.json ./
COPY . .

FROM base as dev
RUN npm install
COPY google_application_credentials.json ./
ENV GOOGLE_APPLICATION_CRDENTIALS=/app/google_application_credentials.json
CMD node -e 'require("./index").scheduledFirestoreExport()'

FROM base as production
ENV NODE_ENV=production
# RUN npm install --production
RUN npm ci --only=production
CMD node -e 'require("./index").scheduledFirestoreExport()'
