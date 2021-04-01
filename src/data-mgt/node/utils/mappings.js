const { logElement, logText, logObject } = require("../utils/log");
const isEmpty = require("is-empty");

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
};

function getFieldLabel(field) {
  return fieldsAndLabels[field];
}

function getFieldByLabel(value) {
  return Object.keys(fieldsAndLabels).find(
    (key) => fieldsAndLabels[key] === value
  );
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
        /**
         * in case value is null, then ignore
         *
         */

        return {
          ...newObj,
          [transformedField]: value.trim(),
        };
      },
      {}
    );
    logObject("the transformed object", newObj);
    return newObj;
  } catch (e) {
    console.log(e.message);
  }
};

const availableMeasurements = (measurement) => {
  const {
    field1,
    field2,
    field3,
    field4,
    field5,
    field6,
    field7,
    field8,
    created_at,
  } = measurement;

  return {
    ...(!isEmpty(field1) && { field1: field1 }),
    ...(!isEmpty(field2) && { field2: field2 }),
    ...(!isEmpty(field3) && { field3: field3 }),
    ...(!isEmpty(field4) && { field4: field4 }),
    ...(!isEmpty(field5) && { field5: field5 }),
    ...(!isEmpty(field6) && { field6: field6 }),
    ...(!isEmpty(field7) && { field7: field7 }),
    ...(!isEmpty(field8) && { field8: field8 }),
    ...(!isEmpty(created_at) && { created_at: created_at }),
  };
};

module.exports = {
  getFieldLabel,
  transformMeasurement,
  trasformFieldValues,
  getPositionLabel,
  getFieldByLabel,
  availableMeasurements,
};
