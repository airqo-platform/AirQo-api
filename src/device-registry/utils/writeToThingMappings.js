const HTTPStatus = require("http-status");
function getTSField(measurement, res) {
  let requestBody = {
    api_key: "api_key",
    created_at: "created_at",
    pm2_5: "field1",
    pm10: "field2",
    s2_pm2_5: "field3",
    s2_pm10: "field4",
    latitude: "field5",
    longitude: " field6",
    battery: "field7",
    other_data: "field8",
    latitude: "latitude",
    longitude: " longitude",
  };

  if (requestBody.hasOwnProperty(measurement)) {
    return requestBody[measurement];
  } else {
    return res.status(HTTPStatus.BAD_REQUEST).json({
      success: false,
      message: `the provided quantity kind (${measurement}) does not exist for this organization`,
    });
  }
}

module.exports = getTSField;
