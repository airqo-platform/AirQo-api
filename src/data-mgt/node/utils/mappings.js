const fieldsAndLabels = {
  field1: "pm2_5",
  field2: "pm10",
  field3: "s2_pm2_5",
  field4: "s2_pm10",
  field5: "latitude",
  field6: "longitude",
  field7: "voltage",
  field8: "other_data",
};

function getFieldLabel(field) {
  return fieldsAndLabels[field];
}

module.exports = { getFieldLabel };
