# syntax=docker/dockerfile:1

FROM golang:1.16-alpine as base

WORKDIR /app

COPY go.mod ./
COPY go.sum ./
RUN go mod download

COPY . ./

RUN go build -o /notifications-api

EXPOSE 8080

FROM base as staging

CMD [ "/notifications-api" ]

FROM base as production

ENV GIN_MODE=release

CMD [ "/notifications-api" ]
