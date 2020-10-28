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

const positionsAndLabels = {
  0: "latitude",
  1: "longitude",
  2: "altitude",
  3: "speed",
  4: "satellites",
  5: "hdop",
  6: "internalTemperature",
  7: "internalHumidity",
  8: "externalTemperature",
  9: "ExternalHumidity",
  10: "ExternalPressure",
};

function getFieldLabel(field) {
  return fieldsAndLabels[field];
}

function getPositionLabel(position) {
  return positionsAndLabels[position];
}

function getValuesFromString(stringValues) {
  arrayValues = stringValues.split(",");
  return arrayValues;
}

const trasformFieldValues = async (field) => {
  try {
    let arrayValues = getValuesFromString(field);
    let newObj = await Object.entries(arrayValues).reduce(
      (newObj, [position, value]) => {
        let transformedPosition = getPositionLabel(position);
        return { ...newObj, [transformedPosition]: value.trim() };
      },
      {}
    );
    return newObj;
  } catch (e) {
    console.log(e.message);
  }
};

const transformMeasurement = async (measurement) => {
  try {
    let newObj = await Object.entries(measurement).reduce(
      (newObj, [field, value]) => {
        let transformedField = getFieldLabel(field);

        return {
          ...newObj,
          [transformedField]: value.trim(),
        };
      },
      {}
    );
    return newObj;
  } catch (e) {
    console.log(e.message);
  }
};

module.exports = {
  getFieldLabel,
  transformMeasurement,
  trasformFieldValues,
  getPositionLabel,
};
