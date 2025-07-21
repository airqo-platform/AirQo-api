class BaseResult {
  constructor({
    results = [],
    passedDevices = [],
    failedDevices = [],
    errors = [],
    errorDevices = [],
  } = {}) {
    this.results = results;
    this.passedDevices = passedDevices;
    this.failedDevices = failedDevices;
    this.errors = errors;
    this.errorDevices = errorDevices;
  }
}

class DataCompleteness {
  constructor({
    deviceName = "",
    actual = 0,
    expected = 0,
    completeness = 0,
    missing = 0,
    passed = false,
  } = {}) {
    this.deviceName = deviceName;
    this.actual = actual;
    this.expected = expected;
    this.completeness = completeness;
    this.missing = missing;
    this.passed = passed;
  }
}

class DataCompletenessResult {
  constructor({
    results = [],
    passedDevices = [],
    failedDevices = [],
    errors = [],
    errorDevices = [],
  } = {}) {
    this.results = results;
    this.passedDevices = passedDevices;
    this.failedDevices = failedDevices;
    this.errors = errors;
    this.errorDevices = errorDevices;
  }
}

class IntraSensorCorrelation {
  constructor({
    deviceName = "",
    pm2_5Pearson = null,
    pm10Pearson = null,
    pm2_5R2 = null,
    pm10R2 = null,
    passed = false,
  } = {}) {
    this.deviceName = deviceName;
    this.pm2_5Pearson = pm2_5Pearson;
    this.pm10Pearson = pm10Pearson;
    this.pm2_5R2 = pm2_5R2;
    this.pm10R2 = pm10R2;
    this.passed = passed;
  }

  toDict() {
    return { ...this };
  }
}

class IntraSensorCorrelationResult {
  constructor({
    results = [],
    passedDevices = [],
    failedDevices = [],
    errors = [],
    errorDevices = [],
  } = {}) {
    this.results = results;
    this.passedDevices = passedDevices;
    this.failedDevices = failedDevices;
    this.errors = errors;
    this.errorDevices = errorDevices;
  }
}

class IntraSensorData extends IntraSensorCorrelation {
  constructor(props = {}) {
    super(props);
    this.timestamp = props.timestamp || null;
  }
}

class CollocationBatch {
  constructor(props = {}) {
    this.devices = props.devices || [];
    this.startDate = props.startDate || null;
    this.endDate = props.endDate || null;
    this.dataCompletenessThreshold = props.dataCompletenessThreshold || 0;
    this.dataCompletenessParameter = props.dataCompletenessParameter || "";
  }
}

module.exports = {
  BaseResult,
  DataCompleteness,
  DataCompletenessResult,
  IntraSensorCorrelation,
  IntraSensorCorrelationResult,
  IntraSensorData,
  CollocationBatch,
};
