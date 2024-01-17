const mongoose = require("mongoose");

const dbProjections = {
  NETWORK_INCLUSION_PROJECTION: {
    description: 1,
    name: 1,
    _id: 1,
  },
  NETWORK_EXCLUSION_PROJECTION: (category) => {
    const initialProjection = { nothing: 0 };
    let projection = Object.assign({}, initialProjection);
    if (category === "summary") {
      projection = Object.assign({}, {});
    }
    return projection;
  },
};
module.exports = dbProjections;
