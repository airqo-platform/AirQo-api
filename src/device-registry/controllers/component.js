const Component = require("../models/Component");
const HTTPStatus = require("http-status");

const component = {
  listAll: async (req, res) => {
    const limit = parseInt(req.query.limit, 0);
    const skip = parseInt(req.query.skip, 0);

    try {
      const components = await Component.list({ limit, skip });
      return res.status(HTTPStatus.OK).json(components);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  addComponent: async (req, res) => {
    let {
      quantityKind,
      name,
      measurementUnit,
      description,
      deviceID,
      calibration,
    } = req.body;

    try {
      const component = await Component.createComponent(
        req.body,
        req.params.d_id
      );
      return res.status(HTTPStatus.CREATED).json(component);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  listOne: async (req, res) => {
    try {
      const component = await Component.findById(req.params.c_id);
      return res.status(HTTPStatus.OK).json(component);
    } catch (e) {
      return res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },

  deleteComponent: async (req, res) => {
    let { c_id, d_id } = req.params;
    let componentFilter = { name: c_id };

    try {
      Component.findOneAndRemove(componentFilter, (err, removedComponent) => {
        if (err) {
          return res.status(HTTPStatus.OK).json({
            err,
            success: false,
            message: "unable to delete component",
          });
        } else {
          return res.status(HTTPStatus.OK).json({
            removedComponent,
            success: true,
            message: " component successfully deleted",
          });
        }
      });
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ e, success: false, message: "unable to delete the component" });
    }
  },

  updateComponent: async (req, res) => {
    let { c_id, d_id } = req.params;
    try {
      let componentFilter = { name: c_id };
      await Component.findOneAndUpdate(
        componentFilter,
        req.body,
        {
          new: true,
        },
        (error, updatedComponent) => {
          if (error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              message: "unable to update component",
              error,
              success: false,
            });
          } else if (updatedComponent) {
            return res.status(HTTPStatus.OK).json({
              message: "successfully updated the component settings",
              updatedComponent,
              success: true,
            });
          } else {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              message:
                "component does not exist, please first create the component you are trying to update ",
              success: false,
            });
          }
        }
      );
    } catch (e) {
      return res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ error: e, messsage: "this is a bad request", success: false });
    }
  },

  addValue: async (req, res) => {
    // {
    //   value: { type: Number },
    //   unit: { type: Number },
    //   raw: { type: Number },
    //   weight: { type: Number },
    // },
    try {
      //check the rights of the current user
      // if (!component.owner.equals(req.user._id)) {
      //   res.status(HTTPStatus.UNAUTHORIZED);
      // }
      //update the events schema with the value
    } catch (e) {
      res
        .status(HTTPStatus.BAD_REQUEST)
        .json({ e, message: "unable to add the value", success: false });
    }
  },

  addValues: async (req, res) => {
    // [
    //   {
    //     value: { type: Number },
    //     unit: { type: Number },
    //     raw: { type: Number },
    //     weight: { type: Number },
    //   },
    // ];
    try {
      //check the rights of the current user
      if (!component.owner.equals(req.user._id)) {
        res.status(HTTPStatus.UNAUTHORIZED);
      }
      //update the events schema with the value
    } catch (e) {
      res.status(HTTPStatus.BAD_REQUEST).json(e);
    }
  },
};

module.exports = component;
