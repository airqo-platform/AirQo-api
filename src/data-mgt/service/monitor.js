const HTTPStatus = require("http-status");
const fetch = require("node-fetch");
const request = require("request");
const Channels = require("../models/Channel");
const Feed = require("../models/Feed");
const axios = require("axios");
const redis = require("../config/redis");
const Monitor = require("../models/Monitor");

const data = {
  dataOutOfRange: (req, res) => {},
  incorrectValues: (req, res) => {},
  thingOff: (req, res) => {},
  dueMaintenance: (req, res) => {},
};

module.exports = data;
