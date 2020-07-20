const Sensor = require("../models/Sensor");
const HTTPStatus = require("http-status");

const sense = {
  listAll: async (req, res) => {
    const limit = parseInt(req.query.limit, 0);
    const skip = parseInt(req.query.skip, 0);

    try {
      const sensors = await Sensor.list({ limit, skip });
      return res.status(HTTPStatus.OK).json(sensors);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  addSensor: async (req, res) => {
    try {
      const sensor = await Sensor.createSensor(req.body, req.params.d_id);
      return res.status(HTTPStatus.CREATED).json(sensor);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  listOne: async (req, res) => {
    try {
      const sensor = await Sensor.findById(req.params.s_id);
      return res.status(HTTPStatus.OK).json(sensor);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  delete: async (req, res) => {
    try {
      const sensor = await Sensor.findById(req.params.s_id);
      const device = await Device.findById(req.params.d_id);
      if (!sensor.owner.equals(req.user._id)) {
        return res.status(HTTPStatus.UNAUTHORIZED);
      }
      await device._sensors.remove(req.params.s_id);
      await sensor.remove();
      return res.status(HTTPStatus.OK);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  update: async (req, res) => {
    console.log("we are updating...1");
    try {
      console.log("we are updating...2");
      const sensor = await Sensor.findById(req.params.s_id);
      if (!sensor.owner.equals(req.user)) {
        return res.status(HTTPStatus.UNAUTHORIZED);
      }
      Object.keys(req.body).forEach((key) => {
        sensor[key] = req.body[key];
      });
      return res.status(HTTPStatus.OK).json(await sensor.save());
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  addValue: async (req, res) => {
    try {
      //check the rights of the current user
      if (!sensor.owner.equals(req.user._id)) {
        res.status(HTTPStatus.UNAUTHORIZED);
      }
      //update the events schema with the value
    } catch (e) {
      res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },
};

module.exports = sense;
