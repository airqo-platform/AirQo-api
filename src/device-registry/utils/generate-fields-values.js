const generateFieldValues = (req) => {
  let {
    firstPM2_5,
    firstPM10,
    secondPM2_5,
    secondPM10,
    hum,
    volt,
    temp,
    no2,
    so3,
  } = req.body;

  let fields = [
    ...(!isEmpty(firstPM2_5) && "field1"),
    ...(!isEmpty(firstPM10) && "field2"),
    ...(!isEmpty(secondPM2_5) && "field3"),
    ...(!isEmpty(secondPM10) && "field4"),
    ...(!isEmpty(hum) && "field5"),
    ...(!isEmpty(volt) && "field6"),
    ...(!isEmpty(temp) && "field7"),
    ...(!isEmpty(no2) && "field8"),
    ...(!isEmpty(so3) && "field9"),
  ];

  let value = [
    ...(!isEmpty(firstPM2_5) && firstPM2_5),
    ...(!isEmpty(firstPM10) && firstPM10),
    ...(!isEmpty(secondPM2_5) && secondPM2_5),
    ...(!isEmpty(secondPM10) && secondPM10),
    ...(!isEmpty(hum) && hum),
    ...(!isEmpty(volt) && volt),
    ...(!isEmpty(temp) && temp),
    ...(!isEmpty(no2) && no2),
    ...(!isEmpty(so3) && so3),
  ];
  return { fields, value };
};

module.exports = generateFieldValues;
