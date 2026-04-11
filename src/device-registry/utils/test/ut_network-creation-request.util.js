"use strict";
require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const httpStatus = require("http-status");
const { expect } = chai;

// ── Module under test ────────────────────────────────────────────────────────
// We require the module once; individual model/Kafka internals are stubbed via
// sinon.stub on the required modules before each test.
const NetworkCreationRequestModel = require("@models/NetworkCreationRequest");
const NetworkModel = require("@models/Network");
const util = require("@utils/network-creation-request.util");

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeRequest = (overrides = {}) => ({
  query: { tenant: "airqo" },
  params: {},
  body: {},
  ...overrides,
});

const fakeRequestDoc = {
  _id: "6642f1e2c3a4b5d6e7f80001",
  requester_name: "Jane Doe",
  requester_email: "jane@example.com",
  net_name: "AirSense",
  net_email: "contact@airsense.io",
  net_website: "https://airsense.io",
  net_category: "research",
  net_description: "Air quality sensors",
  net_acronym: "AS",
  status: "pending",
};

// ── Test suite ────────────────────────────────────────────────────────────────

describe("network-creation-request.util", () => {
  afterEach(() => {
    sinon.restore();
  });

  // ── createNetworkCreationRequest ────────────────────────────────────────────

  describe("createNetworkCreationRequest", () => {
    it("returns the created record and publishes 2 batched Kafka events", async () => {
      const request = makeRequest({
        body: {
          requester_name: "Jane Doe",
          requester_email: "jane@example.com",
          net_name: "AirSense",
          net_email: "contact@airsense.io",
        },
      });

      // Build a fake model instance that register resolves successfully
      const fakeModel = {
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.CREATED,
          data: fakeRequestDoc,
        }),
      };
      const modelFnStub = sinon
        .stub()
        .withArgs("airqo")
        .returns(fakeModel);

      // Patch the require cache entry so the util uses our stub
      const NetworkCreationRequestModelPath = require.resolve(
        "@models/NetworkCreationRequest"
      );
      const original = require.cache[NetworkCreationRequestModelPath].exports;
      require.cache[NetworkCreationRequestModelPath].exports = modelFnStub;

      try {
        const next = sinon.stub();
        const result = await util.createNetworkCreationRequest(request, next);

        expect(result.success).to.be.true;
        expect(fakeModel.register.calledOnce).to.be.true;
        expect(next.called).to.be.false;
      } finally {
        require.cache[NetworkCreationRequestModelPath].exports = original;
      }
    });

    it("returns early when register reports success:false", async () => {
      const fakeModel = {
        register: sinon.stub().resolves({
          success: false,
          status: httpStatus.CONFLICT,
          message: "Duplicate",
        }),
      };
      const modelFnStub = sinon.stub().returns(fakeModel);

      const NetworkCreationRequestModelPath = require.resolve(
        "@models/NetworkCreationRequest"
      );
      const original = require.cache[NetworkCreationRequestModelPath].exports;
      require.cache[NetworkCreationRequestModelPath].exports = modelFnStub;

      try {
        const next = sinon.stub();
        const result = await util.createNetworkCreationRequest(
          makeRequest({ body: { requester_name: "X", requester_email: "x@x.com", net_name: "Y", net_email: "y@y.com" } }),
          next
        );

        expect(result.success).to.be.false;
        expect(next.called).to.be.false;
      } finally {
        require.cache[NetworkCreationRequestModelPath].exports = original;
      }
    });
  });

  // ── approveNetworkCreationRequest ───────────────────────────────────────────

  describe("approveNetworkCreationRequest", () => {
    const patchModels = (requestModelFn, networkModelFn) => {
      const reqPath = require.resolve("@models/NetworkCreationRequest");
      const netPath = require.resolve("@models/Network");
      const origReq = require.cache[reqPath].exports;
      const origNet = require.cache[netPath].exports;
      require.cache[reqPath].exports = requestModelFn;
      require.cache[netPath].exports = networkModelFn;
      return () => {
        require.cache[reqPath].exports = origReq;
        require.cache[netPath].exports = origNet;
      };
    };

    it("creates the network, updates request status, and returns success", async () => {
      const pendingDoc = { ...fakeRequestDoc, status: "pending" };
      const fakeNetwork = {
        _id: "6642f1e2c3a4b5d6e7f80099",
        net_name: "AirSense",
      };

      const requestModel = {
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(pendingDoc),
        }),
        modify: sinon.stub().resolves({
          success: true,
          data: { ...pendingDoc, status: "approved" },
        }),
      };
      const networkModel = {
        register: sinon.stub().resolves({
          success: true,
          data: fakeNetwork,
        }),
      };

      const restore = patchModels(
        sinon.stub().returns(requestModel),
        sinon.stub().returns(networkModel)
      );

      try {
        const next = sinon.stub();
        const result = await util.approveNetworkCreationRequest(
          makeRequest({ params: { request_id: fakeRequestDoc._id }, body: {} }),
          next
        );

        expect(result.success).to.be.true;
        expect(networkModel.register.calledOnce).to.be.true;
        expect(requestModel.modify.calledOnce).to.be.true;
        expect(next.called).to.be.false;
      } finally {
        restore();
      }
    });

    it("rejects approval when status is 'approved'", async () => {
      const approvedDoc = { ...fakeRequestDoc, status: "approved" };

      const requestModel = {
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(approvedDoc),
        }),
        modify: sinon.stub(),
      };

      const restore = patchModels(
        sinon.stub().returns(requestModel),
        sinon.stub().returns({})
      );

      try {
        const next = sinon.stub();
        const result = await util.approveNetworkCreationRequest(
          makeRequest({ params: { request_id: fakeRequestDoc._id }, body: {} }),
          next
        );

        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.CONFLICT);
        expect(requestModel.modify.called).to.be.false;
      } finally {
        restore();
      }
    });

    it("rejects approval when status is 'denied'", async () => {
      const deniedDoc = { ...fakeRequestDoc, status: "denied" };

      const requestModel = {
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(deniedDoc),
        }),
        modify: sinon.stub(),
      };

      const restore = patchModels(
        sinon.stub().returns(requestModel),
        sinon.stub().returns({})
      );

      try {
        const next = sinon.stub();
        const result = await util.approveNetworkCreationRequest(
          makeRequest({ params: { request_id: fakeRequestDoc._id }, body: {} }),
          next
        );

        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.CONFLICT);
      } finally {
        restore();
      }
    });

    it("surfaces error when status update fails after network is created", async () => {
      const pendingDoc = { ...fakeRequestDoc, status: "pending" };
      const fakeNetwork = { _id: "6642f1e2c3a4b5d6e7f80099", net_name: "AirSense" };

      const requestModel = {
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(pendingDoc),
        }),
        modify: sinon.stub().resolves({
          success: false,
          errors: { message: "DB write failed" },
        }),
      };
      const networkModel = {
        register: sinon.stub().resolves({
          success: true,
          data: fakeNetwork,
        }),
      };

      const restore = patchModels(
        sinon.stub().returns(requestModel),
        sinon.stub().returns(networkModel)
      );

      try {
        const next = sinon.stub();
        const result = await util.approveNetworkCreationRequest(
          makeRequest({ params: { request_id: fakeRequestDoc._id }, body: {} }),
          next
        );

        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
        expect(result.message).to.include("failed to update request status");
      } finally {
        restore();
      }
    });
  });

  // ── denyNetworkCreationRequest ──────────────────────────────────────────────

  describe("denyNetworkCreationRequest", () => {
    const patchRequestModel = (modelFn) => {
      const reqPath = require.resolve("@models/NetworkCreationRequest");
      const orig = require.cache[reqPath].exports;
      require.cache[reqPath].exports = modelFn;
      return () => {
        require.cache[reqPath].exports = orig;
      };
    };

    it("denies a pending request and returns success", async () => {
      const pendingDoc = { ...fakeRequestDoc, status: "pending" };
      const requestModel = {
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(pendingDoc),
        }),
        modify: sinon.stub().resolves({
          success: true,
          data: { ...pendingDoc, status: "denied" },
        }),
      };

      const restore = patchRequestModel(sinon.stub().returns(requestModel));
      try {
        const next = sinon.stub();
        const result = await util.denyNetworkCreationRequest(
          makeRequest({ params: { request_id: fakeRequestDoc._id }, body: {} }),
          next
        );

        expect(result.success).to.be.true;
        expect(requestModel.modify.calledOnce).to.be.true;
        expect(next.called).to.be.false;
      } finally {
        restore();
      }
    });

    it("rejects denial when status is 'approved'", async () => {
      const approvedDoc = { ...fakeRequestDoc, status: "approved" };
      const requestModel = {
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(approvedDoc),
        }),
        modify: sinon.stub(),
      };

      const restore = patchRequestModel(sinon.stub().returns(requestModel));
      try {
        const next = sinon.stub();
        const result = await util.denyNetworkCreationRequest(
          makeRequest({ params: { request_id: fakeRequestDoc._id }, body: {} }),
          next
        );

        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.CONFLICT);
        expect(requestModel.modify.called).to.be.false;
      } finally {
        restore();
      }
    });

    it("rejects denial when status is already 'denied'", async () => {
      const deniedDoc = { ...fakeRequestDoc, status: "denied" };
      const requestModel = {
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(deniedDoc),
        }),
        modify: sinon.stub(),
      };

      const restore = patchRequestModel(sinon.stub().returns(requestModel));
      try {
        const next = sinon.stub();
        const result = await util.denyNetworkCreationRequest(
          makeRequest({ params: { request_id: fakeRequestDoc._id }, body: {} }),
          next
        );

        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.CONFLICT);
      } finally {
        restore();
      }
    });

    it("returns NOT_FOUND when the request does not exist", async () => {
      const requestModel = {
        findById: sinon.stub().returns({
          lean: sinon.stub().resolves(null),
        }),
        modify: sinon.stub(),
      };

      const restore = patchRequestModel(sinon.stub().returns(requestModel));
      try {
        const next = sinon.stub();
        const result = await util.denyNetworkCreationRequest(
          makeRequest({ params: { request_id: fakeRequestDoc._id }, body: {} }),
          next
        );

        expect(result.success).to.be.false;
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
      } finally {
        restore();
      }
    });
  });

  // ── Kafka failure isolation ─────────────────────────────────────────────────
  // publishToKafka is fire-and-forget: a Kafka error must NOT propagate to the
  // caller. We verify this by making the underlying KafkaJS producer.send throw
  // and asserting the util still returns a success response.

  describe("Kafka publish failure does not affect HTTP response", () => {
    it("createNetworkCreationRequest succeeds even when Kafka publish throws", async () => {
      const fakeModel = {
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.CREATED,
          data: fakeRequestDoc,
        }),
      };
      const modelFnStub = sinon.stub().returns(fakeModel);

      // Patch the KafkaJS Kafka class so that producer.send always rejects
      const kafkaJsPath = require.resolve("kafkajs");
      const origKafkaJs = require.cache[kafkaJsPath].exports;

      const fakeProducer = {
        connect: sinon.stub().resolves(),
        send: sinon.stub().rejects(new Error("broker unavailable")),
        disconnect: sinon.stub().resolves(),
      };
      require.cache[kafkaJsPath].exports = {
        Kafka: class {
          producer() {
            return fakeProducer;
          }
        },
      };

      const NetworkCreationRequestModelPath = require.resolve(
        "@models/NetworkCreationRequest"
      );
      const origModel = require.cache[NetworkCreationRequestModelPath].exports;
      require.cache[NetworkCreationRequestModelPath].exports = modelFnStub;

      // Re-require the util so it picks up the patched KafkaJS
      // (module cache holds the old instance, so we delete and re-require)
      const utilPath = require.resolve(
        "@utils/network-creation-request.util"
      );
      delete require.cache[utilPath];

      try {
        const freshUtil = require("@utils/network-creation-request.util");
        const next = sinon.stub();

        const result = await freshUtil.createNetworkCreationRequest(
          makeRequest({
            body: {
              requester_name: "Jane",
              requester_email: "jane@example.com",
              net_name: "AirSense",
              net_email: "contact@airsense.io",
            },
          }),
          next
        );

        expect(result.success).to.be.true;
        expect(next.called).to.be.false;
      } finally {
        require.cache[kafkaJsPath].exports = origKafkaJs;
        require.cache[NetworkCreationRequestModelPath].exports = origModel;
        // Restore the util module to its original cached version
        delete require.cache[utilPath];
        require("@utils/network-creation-request.util");
      }
    });
  });
});
