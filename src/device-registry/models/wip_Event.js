function createProjection(external, brief, _as) {
  let projection = {
    _id: 0,
  };

  if (external === "yes" || brief === "yes") {
    projection["s2_pm10"] = 0;
    projection["s1_pm10"] = 0;
    projection["s2_pm2_5"] = 0;
    projection["s1_pm2_5"] = 0;
    projection["rtc_adc"] = 0;
    projection["rtc_v"] = 0;
    projection["rtc"] = 0;
    projection["stc_adc"] = 0;
    projection["stc_v"] = 0;
    projection["stc"] = 0;
    projection["pm1"] = 0;
    projection["externalHumidity"] = 0;
    projection["externalAltitude"] = 0;
    projection["internalHumidity"] = 0;
    projection["externalTemperature"] = 0;
    projection["internalTemperature"] = 0;
    projection["hdop"] = 0;
    projection["satellites"] = 0;
    projection["speed"] = 0;
    projection["altitude"] = 0;
    projection["site_image"] = 0;
    projection["location"] = 0;
    projection["network"] = 0;
    projection["battery"] = 0;
    projection["average_pm10"] = 0;
    projection["average_pm2_5"] = 0;
    projection["device_number"] = 0;
    projection["pm2_5.uncertaintyValue"] = 0;
    projection["pm2_5.calibratedValue"] = 0;
    projection["pm2_5.standardDeviationValue"] = 0;
    projection["pm10.uncertaintyValue"] = 0;
    projection["pm10.calibratedValue"] = 0;
    projection["pm10.standardDeviationValue"] = 0;
    projection["no2.uncertaintyValue"] = 0;
    projection["no2.standardDeviationValue"] = 0;
    projection["no2.calibratedValue"] = 0;
    projection["site"] = 0;
    projection[_as] = 0;
  }

  return projection;
}
function constructQuery(
  search,
  from,
  localField,
  foreignField,
  as,
  pm2_5,
  pm10,
  s1_pm2_5,
  s2_pm2_5,
  s1_pm10,
  s2_pm10,
  elementAtIndex0,
  _as,
  s2_pm2_5
) {
  return {
    search,
    from,
    localField,
    foreignField,
    as,
    pm2_5,
    pm10,
    s1_pm2_5,
    s2_pm2_5,
    s1_pm10,
    s2_pm10,
    elementAtIndex0,
    _as,
    s2_pm2_5,
  };
}
async function executeQuery(
  model,
  query,
  projection,
  skip,
  limit,
  page,
  startTime,
  endTime
) {
  // Start the aggregation pipeline
  let pipeline = model.aggregate();

  // Add stages to the pipeline based on the query
  if (query.search) {
    pipeline = pipeline.match(query.search);
  }

  if (query.localField && query.foreignField && query.as) {
    pipeline = pipeline.lookup({
      from: query.from,
      localField: query.localField,
      foreignField: query.foreignField,
      as: query.as,
    });
  }

  if (projection) {
    pipeline = pipeline.project(projection);
  }

  if (skip || limit) {
    pipeline = pipeline.skip(skip).limit(limit);
  }

  // Execute the pipeline and return the result
  const data = await pipeline.exec();

  return data;
}
async function fetchData(model, filter) {
  // Destructure filter properties
  let {
    metadata,
    external,
    tenant,
    running,
    recent,
    brief,
    index,
    skip,
    limit,
    page,
  } = filter;

  if (page) {
    skip = parseInt((page - 1) * limit);
  }

  logObject("filter BABY", filter);

  const startTime = filter["values.time"]["$gte"];
  const endTime = filter["values.time"]["$lte"];
  let idField;

  let search = filter;
  let groupId = "$device";
  let localField = "device";
  let foreignField = "name";
  let from = "devices";
  let _as = "_deviceDetails";
  let as = "deviceDetails";
  let pm2_5 = "$average_pm2_5";
  let pm10 = "$average_pm10";
  let s1_pm2_5 = "$pm2_5";
  let s2_pm2_5 = "$s2_pm2_5";
  let s2_pm10 = "$s2_pm10";
  let s1_pm10 = "$pm10";
  let elementAtIndex0 = elementAtIndexName(metadata, recent);

  delete search["external"];
  delete search["frequency"];
  delete search["metadata"];
  delete search["tenant"];
  delete search["device"];
  delete search["recent"];
  delete search["page"];
  delete search["running"];
  delete search["brief"];
  delete search["index"];
  delete search["limit"];
  delete search["skip"];

  // Use createProjection function
  let projection = createProjection(external, brief, _as);

  // Use constructQuery function
  let query = constructQuery(
    search,
    from,
    localField,
    foreignField,
    as,
    pm2_5,
    pm10,
    s1_pm2_5,
    s2_pm2_5,
    s1_pm10,
    s2_pm10,
    elementAtIndex0,
    _as,
    s2_pm2_5
  );

  // Use executeQuery function
  const data = await executeQuery(
    model,
    query,
    projection,
    skip,
    limit,
    page,
    startTime,
    endTime,
    _as,
    s2_pm2_5
  );

  return data;
}
