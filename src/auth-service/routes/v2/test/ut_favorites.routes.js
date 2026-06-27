require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const proxyquire = require("proxyquire").noPreserveCache();

describe("Favorite Router", () => {
  let app;
  let createFavoriteController;

  beforeEach(() => {
    createFavoriteController = {
      list: sinon.stub(),
      create: sinon.stub(),
      update: sinon.stub(),
      delete: sinon.stub(),
      syncFavorites: sinon.stub(),
    };

    // Require the route AFTER stubs are in place so the router binds our stubs
    const router = proxyquire("../favorites.routes", {
      "@controllers/favorite.controller": createFavoriteController,
    });

    app = express();
    app.use(express.json());
    app.use(router);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("GET /favorites", () => {
    it("should return a list of favorites with status code 200", async () => {
      createFavoriteController.list.callsFake((req, res) =>
        res.status(200).json([])
      );

      const response = await request(app).get("/favorites").expect(200);
      expect(response.body).to.be.an("array");
    });
  });
});
