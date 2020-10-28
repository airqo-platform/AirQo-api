const fieldsAndLabels = {
  field1: "pm2_5",
  field2: "pm10",
  field3: "s2_pm2_5",
  field4: "s2_pm10",
  field5: "latitude",
  field6: "longitude",
  field7: "battery",
  field8: "other_data",
};

function getFieldLabel(field) {
  return fieldsAndLabels[field];
}

const transformMeasurement = async (measurement) => {
  try {
    let newObj = await Object.entries(measurement).reduce(
      (newObj, [field, value]) => {
        let transformedField = getFieldLabel(field);
        return { ...newObj, [transformedField]: value.trim() };
      },
      {}
    );
    return newObj;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = { getFieldLabel, transformMeasurement };
