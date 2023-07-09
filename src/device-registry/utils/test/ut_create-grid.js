require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const faker = require("faker");
const createGrid = require("@utils/create-grid");

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

  describe("streamCreate", () => {
    it("should process data in a stream and save to the database", async () => {
      const request = { body: { shape: { coordinates: [] } } };

      // Stub the necessary functions and methods
      const calculateGeographicalCenterStub = sinon
        .stub(createGrid, "calculateGeographicalCenter")
        .resolves({
          success: true,
          data: [],
        });
      const GridTransformStreamStub = sinon.stub(
        createGrid,
        "GridTransformStream"
      );
      const ReadableStub = sinon.stub();
      const WritableStub = sinon.stub();
      const pipelineStub = sinon.stub();

      GridTransformStreamStub.returns({
        _transform: sinon.stub(),
        push: sinon.stub(),
      });

      ReadableStub.returns({
        push: sinon.stub(),
        read: sinon.stub(),
      });

      WritableStub.returns({
        write: sinon.stub(),
      });

      sinon.replace(createGrid, "Readable", ReadableStub);
      sinon.replace(createGrid, "Writable", WritableStub);
      sinon.replace(createGrid.stream, "pipeline", pipelineStub);

      await createGrid.streamCreate(request);

      expect(calculateGeographicalCenterStub.calledOnce).to.be.true;
      expect(GridTransformStreamStub.calledOnce).to.be.true;
      expect(ReadableStub.calledOnce).to.be.true;
      expect(WritableStub.calledOnce).to.be.true;
      expect(pipelineStub.calledOnce).to.be.true;

      // Restore the stubbed functions and methods
      calculateGeographicalCenterStub.restore();
      GridTransformStreamStub.restore();
      sinon.restore();
    });

    it("should handle errors gracefully", async () => {
      const request = { body: { shape: { coordinates: [] } } };

      // Stub the necessary functions and methods to throw an error
      const calculateGeographicalCenterStub = sinon
        .stub(createGrid, "calculateGeographicalCenter")
        .throws(new Error("Geographical center calculation error"));
      const GridTransformStreamStub = sinon.stub(
        createGrid,
        "GridTransformStream"
      );
      const ReadableStub = sinon.stub();
      const WritableStub = sinon.stub();
      const pipelineStub = sinon.stub();

      GridTransformStreamStub.returns({
        _transform: sinon.stub(),
        push: sinon.stub(),
      });

      ReadableStub.returns({
        push: sinon.stub(),
        read: sinon.stub(),
      });

      WritableStub.returns({
        write: sinon.stub(),
      });

      sinon.replace(createGrid, "Readable", ReadableStub);
      sinon.replace(createGrid, "Writable", WritableStub);
      sinon.replace(createGrid.stream, "pipeline", pipelineStub);

      const response = await createGrid.streamCreate(request);

      expect(response.success).to.be.false;
      expect(response.status).to.equal(500);
      expect(response.errors.message).to.equal(
        "Geographical center calculation error"
      );

      // Restore the stubbed functions and methods
      calculateGeographicalCenterStub.restore();
      GridTransformStreamStub.restore();
      sinon.restore();
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
    it("should refresh a grid and returnsuccess", async () => {
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
});
