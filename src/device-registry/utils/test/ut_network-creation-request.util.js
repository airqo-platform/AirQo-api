"use strict";
require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const httpStatus = require("http-status");
const { expect } = chai;

// ── Paths (resolved once; used for require.cache patching) ────────────────────
const utilPath = require.resolve("@utils/network-creation-request.util");
const reqModelPath = require.resolve("@models/NetworkCreationRequest");
const netModelPath = require.resolve("@models/Network");
const kafkaJsPath = require.resolve("kafkajs");

/**
 * Re-require the util fresh so it captures whatever is currently in
 * require.cache for its dependencies (models, kafkajs).
 * Call this AFTER patching the relevant cache entries.
 */
const loadUtil = () => {
  delete require.cache[utilPath];
  return require("@utils/network-creation-request.util");
};

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
    // Evict the util from cache so each test group starts fresh
    delete require.cache[utilPath];
  });

  // ── createNetworkCreationRequest ────────────────────────────────────────────

  describe("createNetworkCreationRequest", () => {
    it("returns the created record on success", async () => {
      const fakeModel = {
        register: sinon.stub().resolves({
          success: true,
          status: httpStatus.CREATED,
          data: fakeRequestDoc,
        }),
      };
      const modelFnStub = sinon.stub().returns(fakeModel);

      const origReqModel = require.cache[reqModelPath].exports;
      require.cache[reqModelPath].exports = modelFnStub;

      try {
        const util = loadUtil();
        const next = sinon.stub();
        const result = await util.createNetworkCreationRequest(
          makeRequest({
            body: {
              requester_name: "Jane Doe",
              requester_email: "jane@example.com",
              net_name: "AirSense",
              net_email: "contact@airsense.io",
            },
          }),
          next
        );

        expect(result.success).to.be.true;
        expect(fakeModel.register.calledOnce).to.be.true;
        expect(next.called).to.be.false;
      } finally {
        require.cache[reqModelPath].exports = origReqModel;
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

      const origReqModel = require.cache[reqModelPath].exports;
      require.cache[reqModelPath].exports = modelFnStub;

      try {
        const util = loadUtil();
        const next = sinon.stub();
        const result = await util.createNetworkCreationRequest(
          makeRequest({
            body: {
              requester_name: "X",
              requester_email: "x@x.com",
              net_name: "Y",
              net_email: "y@y.com",
            },
          }),
          next
        );

        expect(result.success).to.be.false;
        expect(next.called).to.be.false;
      } finally {
        require.cache[reqModelPath].exports = origReqModel;
      }
    });
  });

  // ── approveNetworkCreationRequest ───────────────────────────────────────────

  describe("approveNetworkCreationRequest", () => {
    const patchModels = (requestModelFn, networkModelFn) => {
      const origReq = require.cache[reqModelPath].exports;
      const origNet = require.cache[netModelPath].exports;
      require.cache[reqModelPath].exports = requestModelFn;
      require.cache[netModelPath].exports = networkModelFn;
      return () => {
        require.cache[reqModelPath].exports = origReq;
        require.cache[netModelPath].exports = origNet;
      };
    };

    it("creates the network, updates request status, and returns success", async () => {
      const pendingDoc = { ...fakeRequestDoc, status: "pending" };
      const fakeNetwork = { _id: "6642f1e2c3a4b5d6e7f80099", net_name: "AirSense" };

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
        register: sinon.stub().resolves({ success: true, data: fakeNetwork }),
      };

      const restore = patchModels(
        sinon.stub().returns(requestModel),
        sinon.stub().returns(networkModel)
      );

      try {
        const util = loadUtil();
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
        const util = loadUtil();
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
        const util = loadUtil();
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
        register: sinon.stub().resolves({ success: true, data: fakeNetwork }),
      };

      const restore = patchModels(
        sinon.stub().returns(requestModel),
        sinon.stub().returns(networkModel)
      );

      try {
        const util = loadUtil();
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
      const orig = require.cache[reqModelPath].exports;
      require.cache[reqModelPath].exports = modelFn;
      return () => {
        require.cache[reqModelPath].exports = orig;
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
        const util = loadUtil();
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
        const util = loadUtil();
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
        const util = loadUtil();
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
        const util = loadUtil();
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

      const fakeProducer = {
        connect: sinon.stub().resolves(),
        send: sinon.stub().rejects(new Error("broker unavailable")),
        disconnect: sinon.stub().resolves(),
      };
      const origKafkaJs = require.cache[kafkaJsPath].exports;
      const origReqModel = require.cache[reqModelPath].exports;

      require.cache[kafkaJsPath].exports = {
        Kafka: class {
          producer() {
            return fakeProducer;
          }
        },
      };
      require.cache[reqModelPath].exports = modelFnStub;

      try {
        const util = loadUtil();
        const next = sinon.stub();
        const result = await util.createNetworkCreationRequest(
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
        require.cache[reqModelPath].exports = origReqModel;
      }
    });
  });
});
