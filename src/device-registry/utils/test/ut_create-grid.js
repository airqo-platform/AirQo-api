require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const createGrid = require("@utils/create-grid");
const mongoose = require("mongoose");
const { expect } = chai;

describe("createGrid", () => {
  describe("batchCreate", () => {
    it("should process data in batches and insert into the database", async () => {
      const request = { body: { shape: { coordinates: [] } } };

      // Stub the GridModel and insertMany function
      const gridModelStub = sinon.stub(createGrid, "GridModel");
      const insertManyStub = sinon.stub().resolves();

      gridModelStub.returns({
        insertMany: insertManyStub,
      });

      await createGrid.batchCreate(request);

      expect(insertManyStub.calledOnce).to.be.true;

      // Restore the stubbed functions
      gridModelStub.restore();
    });

    it("should handle errors gracefully", async () => {
      const request = { body: { shape: { coordinates: [] } } };

      // Stub the GridModel and insertMany function to throw an error
      const gridModelStub = sinon.stub(createGrid, "GridModel");
      const insertManyStub = sinon.stub().throws(new Error("Database error"));

      gridModelStub.returns({
        insertMany: insertManyStub,
      });

      const response = await createGrid.batchCreate(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(500);
      expect(response.errors.message).to.equal("Database error");

      // Restore the stubbed functions
      gridModelStub.restore();
    });
  });
  describe("create", () => {
    it("should create a grid and return success", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        body: { shape: { coordinates: [] } },
      };

      // Stub the necessary functions
      const calculateGeographicalCenterStub = sinon
        .stub(createGrid, "calculateGeographicalCenter")
        .resolves({
          success: true,
          data: [],
        });
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        register: sinon.stub().resolves({
          success: true,
          data: {},
        }),
      });
      const kafkaProducerStub = sinon.stub().returns({
        connect: sinon.stub(),
        send: sinon.stub(),
        disconnect: sinon.stub(),
      });
      sinon.stub(createGrid, "kafka").value({
        producer: kafkaProducerStub,
      });

      const response = await createGrid.create(request);

      expect(calculateGeographicalCenterStub.calledOnce).to.be.true;
      expect(GridModelStub.calledOnce).to.be.true;
      expect(kafkaProducerStub.calledOnce).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(200);

      // Restore the stubbed functions
      calculateGeographicalCenterStub.restore();
      GridModelStub.restore();
      sinon.restore();
    });

    it("should handle errors during grid creation", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        body: { shape: { coordinates: [] } },
      };

      // Stub the necessary functions to throw an error
      const calculateGeographicalCenterStub = sinon
        .stub(createGrid, "calculateGeographicalCenter")
        .throws(new Error("Geographical center calculation error"));
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        register: sinon.stub().throws(new Error("Grid registration error")),
      });
      const kafkaProducerStub = sinon.stub().returns({
        connect: sinon.stub(),
        send: sinon.stub(),
        disconnect: sinon.stub(),
      });
      sinon.stub(createGrid, "kafka").value({
        producer: kafkaProducerStub,
      });

      const response = await createGrid.create(request);

      expect(calculateGeographicalCenterStub.calledOnce).to.be.true;
      expect(GridModelStub.calledOnce).to.be.true;
      expect(kafkaProducerStub.notCalled).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(500);
      expect(response.errors.message).to.equal("Grid registration error");

      // Restore the stubbed functions
      calculateGeographicalCenterStub.restore();
      GridModelStub.restore();
      sinon.restore();
    });
  });
  describe("update", () => {
    it("should update a grid and return success", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        body: {},
      };

      // Stub the necessary functions
      const generateFilterStub = sinon
        .stub(createGrid, "generateFilter")
        .returns({});
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        modify: sinon.stub().resolves({
          success: true,
          data: {},
        }),
      });

      const response = await createGrid.update(request);

      expect(generateFilterStub.calledOnce).to.be.true;
      expect(GridModelStub.calledOnce).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(200);

      // Restore the stubbed functions
      generateFilterStub.restore();
      GridModelStub.restore();
    });

    it("should handle errors during grid update", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        body: {},
      };

      // Stub the necessary functions to throw an error
      const generateFilterStub = sinon
        .stub(createGrid, "generateFilter")
        .returns({});
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        modify: sinon.stub().throws(new Error("Grid update error")),
      });

      const response = await createGrid.update(request);

      expect(generateFilterStub.calledOnce).to.be.true;
      expect(GridModelStub.calledOnce).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(500);
      expect(response.errors.message).to.equal("Grid update error");

      // Restore the stubbed functions
      generateFilterStub.restore();
      GridModelStub.restore();
    });
  });
  describe("delete", () => {
    it("should delete a grid and return success", async () => {
      const request = {
        query: { tenant: "test_tenant" },
      };

      // Stub the necessary functions
      const generateFilterStub = sinon
        .stub(createGrid, "generateFilter")
        .returns({});
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        remove: sinon.stub().resolves({
          success: true,
          data: {},
        }),
      });

      const response = await createGrid.delete(request);

      expect(generateFilterStub.calledOnce).to.be.true;
      expect(GridModelStub.calledOnce).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(200);

      // Restore the stubbed functions
      generateFilterStub.restore();
      GridModelStub.restore();
    });

    it("should handle errors during grid deletion", async () => {
      const request = {
        query: { tenant: "test_tenant" },
      };

      // Stub the necessary functions to throw an error
      const generateFilterStub = sinon
        .stub(createGrid, "generateFilter")
        .returns({});
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        remove: sinon.stub().throws(new Error("Grid deletion error")),
      });

      const response = await createGrid.delete(request);

      expect(generateFilterStub.calledOnce).to.be.true;
      expect(GridModelStub.calledOnce).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(500);
      expect(response.errors.message).to.equal("Grid deletion error");

      // Restore the stubbed functions
      generateFilterStub.restore();
      GridModelStub.restore();
    });
  });
  describe("refresh", () => {
    it("should refresh a grid and return success", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        params: { grid_id: "grid_id" },
      };

      // Stub the necessary functions
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        findById: sinon.stub().returns({}),
      });
      const createGridFindSitesStub = sinon
        .stub(createGrid, "findSites")
        .resolves({
          success: true,
          data: [],
        });
      const SiteModelStub = sinon.stub(createGrid, "SiteModel").returns({
        updateMany: sinon.stub().resolves({ ok: true }),
      });

      const response = await createGrid.refresh(request);

      expect(GridModelStub.calledOnce).to.be.true;
      expect(createGridFindSitesStub.calledOnce).to.be.true;
      expect(SiteModelStub.calledTwice).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(200);

      // Restore the stubbed functions
      GridModelStub.restore();
      createGridFindSitesStub.restore();
      SiteModelStub.restore();
    });

    it("should handle errors during grid refresh", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        params: { grid_id: "grid_id" },
      };

      // Stub the necessary functions to throw an error
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        findById: sinon.stub().returns(null),
      });

      const response = await createGrid.refresh(request);

      expect(GridModelStub.calledOnce).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(400);
      expect(response.errors.message).to.equal(
        "Invalid grid ID grid_id, please crosscheck"
      );

      // Restore the stubbed functions
      GridModelStub.restore();
    });
  });
  describe("calculateGeographicalCenter", () => {
    it("should calculate the geographical center for a polygon shape", async () => {
      const request = {
        body: {
          shape: {
            coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
            type: "Polygon",
          },
        },
      };

      const response = await createGrid.calculateGeographicalCenter(request);

      expect(response.success).to.be.true;
      expect(response.status).to.equal(200);
      expect(response.data).to.deep.equal([{ latitude: 5, longitude: 5 }]);
    });

    it("should calculate the geographical center for a multi-polygon shape", async () => {
      const request = {
        body: {
          shape: {
            coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
            type: "MultiPolygon",
          },
        },
      };

      const response = await createGrid.calculateGeographicalCenter(request);

      expect(response.success).to.be.true;
      expect(response.status).to.equal(200);
      expect(response.data).to.deep.equal([{ latitude: 5, longitude: 5 }]);
    });

    it("should handle missing coordinates", async () => {
      const request = {
        body: {
          shape: {
            type: "Polygon",
          },
        },
      };

      const response = await createGrid.calculateGeographicalCenter(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(400);
      expect(response.errors.message).to.equal("Missing coordinates");
    });

    it("should handle errors during geographical center calculation", async () => {
      const request = {
        body: {
          shape: {
            coordinates: [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]],
            type: "Polygon",
          },
        },
      };

      // Stub the necessary function to throw an error
      sinon
        .stub(geolib, "getCenter")
        .throws(new Error("Geographical center calculation error"));

      const response = await createGrid.calculateGeographicalCenter(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(500);
      expect(response.errors.message).to.equal(
        "Geographical center calculation error"
      );

      // Restore the stubbed function
      sinon.restore();
    });
  });
  describe("findSites", () => {
    it("should find sites within a grid and return success", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        body: {},
      };

      // Stub the necessary functions
      const generateFilterStub = sinon
        .stub(createGrid, "generateFilter")
        .returns({});
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        findOne: sinon.stub().returns({}),
      });
      const createGridFindSitesStub = sinon
        .stub(createGrid, "findSites")
        .resolves({
          success: true,
          data: [],
        });

      const response = await createGrid.findSites(request);

      expect(generateFilterStub.calledOnce).to.be.true;
      expect(GridModelStub.calledOnce).to.be.true;
      expect(createGridFindSitesStub.calledOnce).to.be.true;
      expect(response.success).to.be.true;
      expect(response.status).to.equal(200);

      // Restore the stubbed functions
      generateFilterStub.restore();
      GridModelStub.restore();
      createGridFindSitesStub.restore();
    });

    it("should handle errors during site search", async () => {
      const request = {
        query: { tenant: "test_tenant" },
        body: {},
      };

      // Stub the necessary functions to throw an error
      const generateFilterStub = sinon
        .stub(createGrid, "generateFilter")
        .returns({});
      const GridModelStub = sinon.stub(createGrid, "GridModel").returns({
        findOne: sinon.stub().returns(null),
      });

      const response = await createGrid.findSites(request);

      expect(generateFilterStub.calledOnce).to.be.true;
      expect(GridModelStub.calledOnce).to.be.true;
      expect(response.success).to.be.false;
      expect(response.status).to.equal(400);
      expect(response.errors.message).to.equal(
        "Invalid grid ID, please crosscheck"
      );

      // Restore the stubbed functions
      generateFilterStub.restore();
      GridModelStub.restore();
    });
  });
  describe("generateFilter", () => {
    it("should generate a filter object based on request parameters", () => {
      const request = {
        query: {
          tenant: "test_tenant",
          grid_id: "grid_id",
        },
        body: {
          status: "active",
        },
      };

      const filter = createGrid.generateFilter(request);

      expect(filter).to.deep.equal({
        tenant: "test_tenant",
        _id: "grid_id",
        status: "active",
      });
    });

    it("should handle missing request parameters", () => {
      const request = {
        query: {},
        body: {},
      };

      const filter = createGrid.generateFilter(request);

      expect(filter).to.deep.equal({});
    });
  });
  describe("list", () => {
    it("should list grids with pagination", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          skip: 0,
          // Add other query parameters as needed for filtering
        },
      };

      // Mock the GridModel and its list method
      const GridModelMock = sinon.stub().returns({
        list: sinon.stub().resolves({
          // Sample response from the GridModel.list() method
          success: true,
          data: [
            // Sample grid data
            // Add the necessary grid data for testing
          ],
        }),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("grids")
        .returns(GridModelMock);

      // Call the function and assert
      const result = await createGrid.list(request);
      expect(GridModelMock.calledOnce).to.be.true;
      expect(GridModelMock().list.calledOnce).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle error during listing grids", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          skip: 0,
          // Add other query parameters as needed for filtering
        },
      };

      // Mock the GridModel and its list method to throw an error
      const GridModelMock = sinon.stub().returns({
        list: sinon.stub().throws(new Error("Some error")),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("grids")
        .returns(GridModelMock);

      // Call the function and assert
      const result = await createGrid.list(request);
      expect(GridModelMock.calledOnce).to.be.true;
      expect(GridModelMock().list.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., filtering, pagination, etc.
  });
  describe("listAdminLevels", () => {
    it("should list admin levels with pagination", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          skip: 0,
          // Add other query parameters as needed for filtering
        },
      };

      // Mock the AdminLevelModel and its list method
      const AdminLevelModelMock = sinon.stub().returns({
        list: sinon.stub().resolves({
          // Sample response from the AdminLevelModel.list() method
          success: true,
          data: [
            // Sample admin level data
            // Add the necessary admin level data for testing
          ],
        }),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("adminlevels")
        .returns(AdminLevelModelMock);

      // Call the function and assert
      const result = await createGrid.listAdminLevels(request);
      expect(AdminLevelModelMock.calledOnce).to.be.true;
      expect(AdminLevelModelMock().list.calledOnce).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle error during listing admin levels", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          skip: 0,
          // Add other query parameters as needed for filtering
        },
      };

      // Mock the AdminLevelModel and its list method to throw an error
      const AdminLevelModelMock = sinon.stub().returns({
        list: sinon.stub().throws(new Error("Some error")),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("adminlevels")
        .returns(AdminLevelModelMock);

      // Call the function and assert
      const result = await createGrid.listAdminLevels(request);
      expect(AdminLevelModelMock.calledOnce).to.be.true;
      expect(AdminLevelModelMock().list.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., filtering, pagination, etc.
  });
  describe("updateAdminLevel", () => {
    it("should update an admin level", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
        body: {
          // Add the update data
        },
      };

      // Mock the AdminLevelModel and its modify method
      const AdminLevelModelMock = sinon.stub().returns({
        modify: sinon.stub().resolves({
          // Sample response from the AdminLevelModel.modify() method
          success: true,
          data: {
            // Updated admin level data
            // Add the necessary data for testing
          },
        }),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("adminlevels")
        .returns(AdminLevelModelMock);

      // Call the function and assert
      const result = await createGrid.updateAdminLevel(request);
      expect(AdminLevelModelMock.calledOnce).to.be.true;
      expect(AdminLevelModelMock().modify.calledOnce).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle error during admin level update", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
        body: {
          // Add the update data
        },
      };

      // Mock the AdminLevelModel and its modify method to throw an error
      const AdminLevelModelMock = sinon.stub().returns({
        modify: sinon.stub().throws(new Error("Some error")),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("adminlevels")
        .returns(AdminLevelModelMock);

      // Call the function and assert
      const result = await createGrid.updateAdminLevel(request);
      expect(AdminLevelModelMock.calledOnce).to.be.true;
      expect(AdminLevelModelMock().modify.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., invalid admin level data, missing query parameters, etc.
  });
  describe("deleteAdminLevel", () => {
    it("should delete an admin level", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
      };

      // Mock the AdminLevelModel and its remove method
      const AdminLevelModelMock = sinon.stub().returns({
        remove: sinon.stub().resolves({
          // Sample response from the AdminLevelModel.remove() method
          success: true,
          data: {
            // Data returned after deleting the admin level
            // Add the necessary data for testing
          },
        }),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("adminlevels")
        .returns(AdminLevelModelMock);

      // Call the function and assert
      const result = await deleteAdminLevel(request);
      expect(AdminLevelModelMock.calledOnce).to.be.true;
      expect(AdminLevelModelMock().remove.calledOnce).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle error during admin level deletion", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
      };

      // Mock the AdminLevelModel and its remove method to throw an error
      const AdminLevelModelMock = sinon.stub().returns({
        remove: sinon.stub().throws(new Error("Some error")),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("adminlevels")
        .returns(AdminLevelModelMock);

      // Call the function and assert
      const result = await deleteAdminLevel(request);
      expect(AdminLevelModelMock.calledOnce).to.be.true;
      expect(AdminLevelModelMock().remove.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., handling missing query parameters, etc.
  });
  describe("createAdminLevel", () => {
    it("should create a new admin level", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
        body: {
          // Add the necessary request body data for testing
        },
      };

      // Mock the AdminLevelModel and its register method
      const AdminLevelModelMock = sinon.stub().returns({
        register: sinon.stub().resolves({
          // Sample response from the AdminLevelModel.register() method
          success: true,
          data: {
            // Data returned after creating the new admin level
            // Add the necessary data for testing
          },
        }),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("adminlevels")
        .returns(AdminLevelModelMock);

      // Call the function and assert
      const result = await createAdminLevel(request);
      expect(AdminLevelModelMock.calledOnce).to.be.true;
      expect(AdminLevelModelMock().register.calledOnce).to.be.true;
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle error during admin level creation", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
        body: {
          // Add the necessary request body data for testing
        },
      };

      // Mock the AdminLevelModel and its register method to throw an error
      const AdminLevelModelMock = sinon.stub().returns({
        register: sinon.stub().throws(new Error("Some error")),
      });
      mongoose.model = sinon
        .stub()
        .withArgs("adminlevels")
        .returns(AdminLevelModelMock);

      // Call the function and assert
      const result = await createAdminLevel(request);
      expect(AdminLevelModelMock.calledOnce).to.be.true;
      expect(AdminLevelModelMock().register.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., handling missing query parameters, etc.
  });
  describe("findGridUsingGPSCoordinates", () => {
    it("should find a grid for the provided GPS coordinates (Polygon)", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
        body: {
          latitude: 52.52,
          longitude: 13.405,
          // Add other necessary body data for testing (e.g., coordinates for a Polygon)
        },
      };

      // Mock the GridModel and its find method to return a sample grid (Polygon)
      const GridModelMock = sinon.stub().returns({
        find: sinon.stub().returns({
          lean: sinon.stub().resolves([
            {
              shape: {
                type: "Polygon",
                coordinates: [
                  [
                    [13.4049, 52.5201],
                    [13.4049, 52.5199],
                    [13.4051, 52.5199],
                    [13.4051, 52.5201],
                    [13.4049, 52.5201],
                  ],
                ],
              },
              // Add other properties of the grid for testing
            },
          ]),
        }),
      });

      // Mock the geolib.isPointInPolygon method to return true for the given coordinates
      const geolibMock = {
        isPointInPolygon: sinon.stub().returns(true),
      };

      // Call the function and assert
      const result = await findGridUsingGPSCoordinates(request, {
        GridModel,
        geolib: geolibMock,
      });
      expect(GridModelMock.calledOnce).to.be.true;
      expect(GridModelMock().find.calledOnce).to.be.true;
      expect(geolibMock.isPointInPolygon.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Grid found");
      // Add more assertions based on your specific logic and expected results
    });

    it("should find a grid for the provided GPS coordinates (MultiPolygon)", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
        body: {
          latitude: 52.52,
          longitude: 13.405,
          // Add other necessary body data for testing (e.g., coordinates for a MultiPolygon)
        },
      };

      // Mock the GridModel and its find method to return a sample grid (MultiPolygon)
      const GridModelMock = sinon.stub().returns({
        find: sinon.stub().returns({
          lean: sinon.stub().resolves([
            {
              shape: {
                type: "MultiPolygon",
                coordinates: [
                  [
                    [
                      [13.4049, 52.5201],
                      [13.4049, 52.5199],
                      [13.4051, 52.5199],
                      [13.4051, 52.5201],
                      [13.4049, 52.5201],
                    ],
                  ],
                  // Add other coordinates for the MultiPolygon
                ],
              },
              // Add other properties of the grid for testing
            },
          ]),
        }),
      });

      // Mock the geolib.isPointInPolygon method to return true for the given coordinates
      const geolibMock = {
        isPointInPolygon: sinon.stub().returns(true),
      };

      // Call the function and assert
      const result = await findGridUsingGPSCoordinates(request, {
        GridModel,
        geolib: geolibMock,
      });
      expect(GridModelMock.calledOnce).to.be.true;
      expect(GridModelMock().find.calledOnce).to.be.true;
      expect(geolibMock.isPointInPolygon.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Grid found");
      // Add more assertions based on your specific logic and expected results
    });

    it("should return a message if no grid is found for the provided GPS coordinates", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
        body: {
          latitude: 52.52,
          longitude: 13.405,
          // Add other necessary body data for testing
        },
      };

      // Mock the GridModel and its find method to return an empty array (no matching grid)
      const GridModelMock = sinon.stub().returns({
        find: sinon.stub().returns({
          lean: sinon.stub().resolves([]),
        }),
      });

      // Call the function and assert
      const result = await findGridUsingGPSCoordinates(request, { GridModel });
      expect(GridModelMock.calledOnce).to.be.true;
      expect(GridModelMock().find.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "No Grid found for the provided coordinates"
      );
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle errors during grid lookup", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "sampleTenant",
          // Add other query parameters as needed
        },
        body: {
          latitude: 52.52,
          longitude: 13.405,
          // Add other necessary body data for testing
        },
      };

      // Mock the GridModel and its find method to throw an error
      const GridModelMock = sinon.stub().returns({
        find: sinon.stub().throws(new Error("Some error")),
      });

      // Call the function and assert
      const result = await findGridUsingGPSCoordinates(request, { GridModel });
      expect(GridModelMock.calledOnce).to.be.true;
      expect(GridModelMock().find.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., handling missing query parameters, invalid GPS coordinates, etc.
  });
  describe("createGridFromShapefile", () => {
    it("should create a grid from the provided shapefile", async () => {
      // Mock the request object
      const uploadedFile = {
        path: "/path/to/shapefile.zip",
        // Add other necessary properties for testing
      };
      const request = {
        file: uploadedFile,
        // Add other necessary request data for testing
      };

      // Mock the fs.existsSync and fs.unlinkSync methods
      const fsMock = {
        existsSync: sinon.stub().returns(true),
        unlinkSync: sinon.stub(),
      };

      // Mock the shapefile.open and shapefile.source methods
      const shapefileOpenStub = sinon.stub();
      const shapefileSourceStub = sinon.stub();

      // Mock the shapefile source read method to return the features from the shapefile
      const features = [
        {
          geometry: {
            type: "Polygon", // Replace with the correct shape type
            coordinates: [
              // Replace with the coordinates for the shape type
              // Example: [ [ [x1, y1], [x2, y2], ... ] ]
            ],
          },
          // Add other properties of the feature as needed for testing
        },
      ];
      shapefileSourceStub.onCall(0).returns({
        read: sinon.stub().resolves({ done: false, value: features[0] }),
      });
      shapefileSourceStub
        .onCall(1)
        .returns({ read: sinon.stub().resolves({ done: true }) });

      const shapefileMock = {
        open: shapefileOpenStub.resolves({
          source: shapefileSourceStub,
        }),
      };

      // Mock the AdmZip constructor and extractAllTo method
      const admZipMock = sinon.stub();
      admZipMock.prototype.extractAllTo = sinon.stub();

      // Call the function and assert
      const result = await createGridFromShapefile(request, {
        AdmZip: admZipMock,
        shapefile: shapefileMock,
        fs: fsMock,
      });
      expect(admZipMock.calledOnceWith(uploadedFile.path)).to.be.true;
      expect(admZipMock.prototype.extractAllTo.calledOnceWith("uploads/", true))
        .to.be.true;
      expect(shapefileOpenStub.calledOnceWith(uploadedFile.path)).to.be.true;
      expect(shapefileSourceStub.calledOnce).to.be.true;
      expect(fsMock.unlinkSync.calledOnceWith(uploadedFile.path)).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully retrieved the Grid format");
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle errors during grid creation from shapefile", async () => {
      // Mock the request object
      const uploadedFile = {
        path: "/path/to/shapefile.zip",
        // Add other necessary properties for testing
      };
      const request = {
        file: uploadedFile,
        // Add other necessary request data for testing
      };

      // Mock the fs.existsSync and fs.unlinkSync methods
      const fsMock = {
        existsSync: sinon.stub().returns(true),
        unlinkSync: sinon.stub(),
      };

      // Mock the shapefile.open method to throw an error
      const shapefileMock = {
        open: sinon.stub().throws(new Error("Some error")),
      };

      // Mock the AdmZip constructor and extractAllTo method
      const admZipMock = sinon.stub();
      admZipMock.prototype.extractAllTo = sinon.stub();

      // Call the function and assert
      const result = await createGridFromShapefile(request, {
        AdmZip: admZipMock,
        shapefile: shapefileMock,
        fs: fsMock,
      });
      expect(admZipMock.calledOnceWith(uploadedFile.path)).to.be.true;
      expect(admZipMock.prototype.extractAllTo.calledOnceWith("uploads/", true))
        .to.be.true;
      expect(fsMock.unlinkSync.calledOnceWith(uploadedFile.path)).to.be.true;
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., handling missing files, invalid shapefiles, etc.
  });
  describe("listAvailableSites", () => {
    it("should retrieve all available sites for a valid grid ID", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        params: {
          grid_id: "valid_grid_id", // Replace with a valid grid ID
        },
      };

      // Mock the GridModel findById method to return a grid
      const gridMock = {
        findById: sinon.stub().resolves({
          _id: "valid_grid_id", // Replace with a valid grid ID
          shape: {
            type: "Polygon", // Replace with the shape type of your grid
            coordinates: [
              // Replace with the coordinates of your grid shape
              // Example: [ [ [x1, y1], [x2, y2], ... ] ]
            ],
          },
          // Add other properties of the grid as needed for testing
        }),
      };

      // Mock the DeviceModel distinct method to return assigned site IDs
      const assignedSiteIds = ["assigned_site_id1", "assigned_site_id2"]; // Replace with assigned site IDs
      const deviceModelMock = {
        distinct: sinon.stub().resolves(assignedSiteIds),
      };

      // Mock the createGrid findSites method to return available sites
      const availableSites = [
        {
          _id: "available_site_id1", // Replace with available site IDs
          // Add other properties of the site as needed for testing
        },
        {
          _id: "available_site_id2", // Replace with available site IDs
          // Add other properties of the site as needed for testing
        },
      ];
      const createGridMock = {
        findSites: sinon.stub().resolves(availableSites),
      };

      // Call the function and assert
      const result = await listAvailableSites(request, {
        GridModel: gridMock,
        DeviceModel: deviceModelMock,
        createGrid: createGridMock,
      });
      expect(gridMock.findById.calledOnceWith("valid_grid_id")).to.be.true;
      expect(
        deviceModelMock.distinct.calledOnceWith("site_id", {
          site_id: { $exists: true },
        })
      ).to.be.true;
      expect(
        createGridMock.findSites.calledOnceWith(request, sinon.match.object)
      ).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        `Retrieved all available sites for grid valid_grid_id`
      );
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle an invalid grid ID", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        params: {
          grid_id: "invalid_grid_id", // Replace with an invalid grid ID
        },
      };

      // Mock the GridModel findById method to return null (invalid grid ID)
      const gridMock = {
        findById: sinon.stub().resolves(null),
      };

      // Call the function and assert
      const result = await listAvailableSites(request, {
        GridModel: gridMock,
      });
      expect(gridMock.findById.calledOnceWith("invalid_grid_id")).to.be.true;
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Invalid grid ID invalid_grid_id, please crosscheck"
      );
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., empty available sites, errors, etc.
  });
  describe("listAssignedSites", () => {
    it("should retrieve all assigned sites for a valid grid ID", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        params: {
          grid_id: "valid_grid_id", // Replace with a valid grid ID
        },
      };

      // Mock the GridModel findById method to return a grid
      const gridMock = {
        findById: sinon.stub().resolves({
          _id: "valid_grid_id", // Replace with a valid grid ID
          // Add other properties of the grid as needed for testing
        }),
      };

      // Mock the SiteModel aggregate method to return assigned sites
      const assignedSites = [
        {
          _id: "site_id1", // Replace with site IDs
          name: "Site 1",
          // Add other properties of the site as needed for testing
        },
        {
          _id: "site_id2", // Replace with site IDs
          name: "Site 2",
          // Add other properties of the site as needed for testing
        },
      ];
      const siteModelMock = {
        aggregate: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(assignedSites),
      };

      // Call the function and assert
      const result = await listAssignedSites(request, {
        GridModel: gridMock,
        SiteModel: siteModelMock,
      });
      expect(gridMock.findById.calledOnceWith("valid_grid_id")).to.be.true;
      expect(siteModelMock.aggregate.calledOnce).to.be.true;
      expect(siteModelMock.exec.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        `retrieved all assigned sites for grid valid_grid_id`
      );
      expect(result.data).to.deep.equal(assignedSites);
      // Add more assertions based on your specific logic and expected results
    });

    it("should handle an invalid grid ID", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
        },
        params: {
          grid_id: "invalid_grid_id", // Replace with an invalid grid ID
        },
      };

      // Mock the GridModel findById method to return null (invalid grid ID)
      const gridMock = {
        findById: sinon.stub().resolves(null),
      };

      // Call the function and assert
      const result = await listAssignedSites(request, {
        GridModel: gridMock,
      });
      expect(gridMock.findById.calledOnceWith("invalid_grid_id")).to.be.true;
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Invalid grid ID invalid_grid_id, please crosscheck"
      );
      // Add more assertions based on your specific error handling logic
    });

    // Add more test cases for different scenarios, e.g., empty assigned sites, errors, etc.
  });
});
