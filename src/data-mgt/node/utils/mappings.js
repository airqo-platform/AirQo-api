const { logObject, logElement } = require("./log");

const fieldsAndLabels = {
  field1: "pm2_5",
  field2: "pm10",
  field3: "s2_pm2_5",
  field4: "s2_pm10",
  field5: "latitude",
  field6: "longitude",
  field7: "battery",
  field8: "other_data",
  created_at: "created_at",
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
  11: "ExternalAltitude",
};

function getFieldLabel(field) {
  try {
    return fieldsAndLabels[field];
  } catch (error) {
    logElement("the getFieldLabel error", error.message);
  }
}

function getFieldByLabel(value) {
  try {
    return Object.keys(fieldsAndLabels).find(
      (key) => fieldsAndLabels[key] === value
    );
  } catch (error) {
    logElement("the getFieldByLabel error", error.message);
  }
}

function getPositionLabel(position) {
  try {
    return positionsAndLabels[position];
  } catch (error) {
    logElement("the getPositionLabel error", error.message);
  }
}

function getValuesFromString(stringValues) {
  try {
    arrayValues = stringValues.split(",");
    return arrayValues;
  } catch (error) {
    logElement("the getValuesFromString error", error.message);
  }
}

const trasformFieldValues = async (field) => {
  try {
    let arrayValues = getValuesFromString(field);
    let newObj = await Object.entries(arrayValues).reduce(
      (newObj, [position, value]) => {
        if (value) {
          let transformedPosition = getPositionLabel(position);
          return { ...newObj, [transformedPosition]: value.trim() };
        }
      },
      {}
    );
    return newObj;
  } catch (e) {
    console.log("the trasformFieldValues error", e.message);
  }
};

const transformMeasurement = async (measurement) => {
  try {
    let newObj = await Object.entries(measurement).reduce(
      (newObj, [field, value]) => {
        if (value) {
          let transformedField = getFieldLabel(field);

          return {
            ...newObj,
            [transformedField]: value,
          };
        }
      },
      {}
    );
    return newObj;
  } catch (e) {
    console.log("the transformMeasurement error", e.message);
  }
};

module.exports = {
  getFieldLabel,
  transformMeasurement,
  trasformFieldValues,
  getPositionLabel,
  getFieldByLabel,
};
