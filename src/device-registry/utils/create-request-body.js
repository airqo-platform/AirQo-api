const createRequestBody = (req) => {
  let {
    api_key,
    created_at,
    pm2_5,
    pm10,
    s2_pm2_5,
    s2_pm10,
    latitude,
    longitude,
    battery,
    other_data,
    status,
  } = req.body;

  let requestBody = {
    api_key: api_key,
    created_at: created_at,
    field1: pm2_5,
    field2: pm10,
    field3: s2_pm2_5,
    field4: s2_pm10,
    field5: latitude,
    field6: longitude,
    field7: battery,
    field8: other_data,
    latitude: latitude,
    longitude: longitude,
    status: status,
  };
  return requestBody;
};

module.exports = createRequestBody;
