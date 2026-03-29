// networks.routes.js
// Mounted at /api/v2/devices/networks
//
// These routes are the canonical home for Network CRUD.
// The legacy paths (/api/v2/devices/cohorts/networks/...) continue to work
// unchanged — both sets of routes share the same core logic in network.util.js.
const express = require("express");
const router = express.Router();
const networkController = require("@controllers/network.controller");
const networkValidators = require("@validators/network.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

// POST   /networks               — create a new network (admin only)
router.post("/", networkValidators.createNetwork, networkController.createNetwork);

// GET    /networks               — list all networks
router.get(
  "/",
  networkValidators.listNetworks,
  pagination(),
  networkController.listNetworks
);

// GET    /networks/:net_id       — get a single network
router.get(
  "/:net_id",
  networkValidators.getNetwork,
  networkController.getNetwork
);

// PUT    /networks/:net_id       — update a network
router.put(
  "/:net_id",
  networkValidators.updateNetwork,
  networkController.updateNetwork
);

// DELETE /networks/:net_id       — delete a network
router.delete(
  "/:net_id",
  networkValidators.deleteNetwork,
  networkController.deleteNetwork
);

module.exports = router;
