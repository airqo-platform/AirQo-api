const queryParam = {
  component: ["comp", "tenant"],
  device: ["device", "tenant"],
  bothDeviceAndComponent: ["device", "comp", "tenant"],
  all: ["tenant"],
};

const filterOptions = {
  device: (device) => {
    return { device: device };
  },

  component: (comp) => {
    return { componentName: comp };
  },

  bothDeviceAndComponent: (device, comp) => {
    return {
      deviceName: device,
      componentName: comp,
    };
  },

  all: {},
};

module.exports = { queryParam, filterOptions };
