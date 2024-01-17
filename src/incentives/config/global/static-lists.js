const mongoose = require("mongoose");

const staticLists = {
  NETWORKS: process.env.NETWORKS
    ? process.env.NETWORKS.split(",").filter((value) => value.trim() !== "")
    : [],
};
module.exports = staticLists;
