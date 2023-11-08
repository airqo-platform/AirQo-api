require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const createPreferenceController = require("@utils/create-preference");
const { validationResult } = require("express-validator");

describe("create preference controller", () => {});
