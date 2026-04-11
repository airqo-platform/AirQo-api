"use strict";
/**
 * network-creation-request.util.js
 *
 * Business logic for the sensor manufacturer (network) creation request workflow:
 *
 *   1. A requester submits a new request via POST /network-creation-requests.
 *      The request is persisted with status "pending" and two Kafka events are
 *      published to `network-creation-requests-topic`:
 *        • An admin notification (action: "new_request")
 *        • A requester acknowledgement (action: "request_received")
 *
 *   2. An admin reviews the request and may:
 *        • Approve  → network is created in device-registry + Kafka event to
 *                     `network-creation-approved-topic` (action: "approved")
 *        • Deny     → status updated to "denied"
 *        • Review   → status updated to "under_review"
 *
 * Terminology note: internally these are "networks"; in all user-facing copy
 * (emails, response messages) they are called "sensor manufacturers".
 */

const { Kafka } = require("kafkajs");
const constants = require("@config/constants");
const NetworkCreationRequestModel = require("@models/NetworkCreationRequest");
const NetworkModel = require("@models/Network");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-creation-request-util`
);
const { HttpError } = require("@utils/shared");

// ─────────────────────────────────────────────────────────────────────────────
// Internal Kafka helper
// ─────────────────────────────────────────────────────────────────────────────

// Kafka client is created once at module scope and reused across calls to avoid
// repeated TCP connection setup on every publish.
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

/**
 * Publish one or more messages to a Kafka topic in a single producer.send()
 * call.  Accepts an array of payloads so callers can batch multiple events
 * without paying the connect/disconnect overhead more than once.
 *
 * Failures are non-fatal: they are logged but never bubble up to the caller so
 * the HTTP response is unaffected.
 */
const publishToKafka = async (topic, payloads) => {
  const messages = (Array.isArray(payloads) ? payloads : [payloads]).map(
    (p) => ({ value: JSON.stringify(p) })
  );

  const producer = kafka.producer();
  try {
    await producer.connect();
    await producer.send({ topic, messages });
    logger.info(
      `Published ${messages.length} Kafka event(s) to topic "${topic}"`
    );
  } catch (error) {
    logger.error(
      `Failed to publish Kafka event(s) to topic "${topic}": ${error.message}`
    );
  } finally {
    try {
      await producer.disconnect();
    } catch (_) {
      /* ignore disconnect errors */
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// CRUD helpers
// ─────────────────────────────────────────────────────────────────────────────

const createNetworkCreationRequest = async (request, next) => {
  try {
    const { query, body } = request;
    const tenant = query.tenant || constants.DEFAULT_TENANT || "airqo";

    const created = await NetworkCreationRequestModel(tenant).register(
      body,
      next
    );

    if (!created || created.success === false) return created;

    // Publish Kafka events (fire-and-forget; failures do not affect the HTTP response)
    const requestTopic =
      constants.NETWORK_CREATION_REQUESTS_TOPIC ||
      "network-creation-requests-topic";

    const eventPayload = {
      requester_name: created.data.requester_name,
      requester_email: created.data.requester_email,
      net_name: created.data.net_name,
      net_email: created.data.net_email,
      net_website: created.data.net_website,
      net_category: created.data.net_category,
      net_description: created.data.net_description,
      net_acronym: created.data.net_acronym,
      request_id: created.data._id,
    };

    // Both events go to the same topic in one producer.send() call:
    //   • "new_request"      → auth-service emails the admin
    //   • "request_received" → auth-service sends acknowledgement to requester
    await publishToKafka(requestTopic, [
      { action: "new_request", ...eventPayload },
      { action: "request_received", ...eventPayload },
    ]);

    return created;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const listNetworkCreationRequests = async (request, next) => {
  try {
    const { query } = request;
    const tenant = query.tenant || constants.DEFAULT_TENANT || "airqo";
    const limit = parseInt(query.limit) || 100;
    const skip = parseInt(query.skip) || 0;

    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.requester_email) filter.requester_email = query.requester_email.toLowerCase();

    return await NetworkCreationRequestModel(tenant).list(
      { filter, limit, skip },
      next
    );
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const getNetworkCreationRequest = async (request, next) => {
  try {
    const { query, params } = request;
    const tenant = query.tenant || constants.DEFAULT_TENANT || "airqo";
    const { request_id } = params;

    const found = await NetworkCreationRequestModel(tenant)
      .findById(new ObjectId(request_id))
      .lean();

    if (!found) {
      return {
        success: false,
        message: "Sensor manufacturer creation request not found",
        errors: { message: "No request found with the provided ID" },
        status: httpStatus.NOT_FOUND,
      };
    }

    return {
      success: true,
      message: "Successfully retrieved request",
      data: found,
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const approveNetworkCreationRequest = async (request, next) => {
  try {
    const { query, body, params } = request;
    const tenant = query.tenant || constants.DEFAULT_TENANT || "airqo";
    const { request_id } = params;
    const { reviewer_notes, reviewed_by } = body;

    // 1. Load the pending request
    const pendingRequest = await NetworkCreationRequestModel(tenant)
      .findById(new ObjectId(request_id))
      .lean();

    if (!pendingRequest) {
      return {
        success: false,
        message: "Request not found",
        errors: { message: "No request found with the provided ID" },
        status: httpStatus.NOT_FOUND,
      };
    }

    const approvableStates = ["pending", "under_review"];
    if (!approvableStates.includes(pendingRequest.status)) {
      return {
        success: false,
        message: "Request cannot be approved",
        errors: {
          message: `Only requests in 'pending' or 'under_review' state can be approved. Current status: '${pendingRequest.status}'`,
        },
        status: httpStatus.CONFLICT,
      };
    }

    // 2. Create the network in device-registry
    const networkBody = {
      net_name: pendingRequest.net_name,
      net_email: pendingRequest.net_email,
      net_website: pendingRequest.net_website,
      net_category: pendingRequest.net_category,
      net_description: pendingRequest.net_description,
      net_acronym: pendingRequest.net_acronym || pendingRequest.net_name,
      name: pendingRequest.net_name,
      net_status: "inactive",
    };

    const createdNetwork = await NetworkModel(tenant).register(
      networkBody,
      next
    );

    if (!createdNetwork || createdNetwork.success === false) {
      return createdNetwork;
    }

    // 3. Mark request as approved
    const updatedRequest = await NetworkCreationRequestModel(tenant).modify(
      {
        filter: { _id: new ObjectId(request_id) },
        update: {
          status: "approved",
          reviewer_notes: reviewer_notes || null,
          reviewed_by: reviewed_by || null,
          reviewed_at: new Date(),
        },
      },
      next
    );

    if (!updatedRequest || updatedRequest.success === false) {
      // The network was created but the request record could not be marked
      // approved. Log and surface the error so the caller can retry rather than
      // leaving the system in an inconsistent state.
      logger.error(
        `approveNetworkCreationRequest: network created (id=${createdNetwork.data._id}) but request status update failed for request_id=${request_id}`
      );
      return {
        success: false,
        message: "Network created but failed to update request status to approved",
        errors: {
          message: updatedRequest
            ? updatedRequest.errors?.message
            : "Status update returned no result",
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    // 4. Publish Kafka event for approval email
    const approvedTopic =
      constants.NETWORK_CREATION_APPROVED_TOPIC ||
      "network-creation-approved-topic";

    await publishToKafka(approvedTopic, {
      action: "approved",
      requester_name: pendingRequest.requester_name,
      requester_email: pendingRequest.requester_email,
      net_name: pendingRequest.net_name,
      request_id: pendingRequest._id,
      network_id: createdNetwork.data._id,
    });

    return {
      success: true,
      message: "Sensor manufacturer creation request approved and network created",
      status: httpStatus.OK,
      data: {
        request: updatedRequest ? updatedRequest.data : null,
        network: createdNetwork.data,
      },
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const denyNetworkCreationRequest = async (request, next) => {
  try {
    const { query, body, params } = request;
    const tenant = query.tenant || constants.DEFAULT_TENANT || "airqo";
    const { request_id } = params;
    const { reviewer_notes, reviewed_by } = body;

    const existing = await NetworkCreationRequestModel(tenant)
      .findById(new ObjectId(request_id))
      .lean();

    if (!existing) {
      return {
        success: false,
        message: "Request not found",
        errors: { message: "No request found with the provided ID" },
        status: httpStatus.NOT_FOUND,
      };
    }

    const deniableStates = ["pending", "under_review"];
    if (!deniableStates.includes(existing.status)) {
      return {
        success: false,
        message: "Request cannot be denied",
        errors: {
          message: `Only requests in 'pending' or 'under_review' state can be denied. Current status: '${existing.status}'`,
        },
        status: httpStatus.CONFLICT,
      };
    }

    const result = await NetworkCreationRequestModel(tenant).modify(
      {
        filter: { _id: new ObjectId(request_id) },
        update: {
          status: "denied",
          reviewer_notes: reviewer_notes || null,
          reviewed_by: reviewed_by || null,
          reviewed_at: new Date(),
        },
      },
      next
    );

    if (!result || result.success === false) return result;

    // Publish Kafka event so auth-service can send a denial email to the requester
    const deniedTopic =
      constants.NETWORK_CREATION_DENIED_TOPIC ||
      "network-creation-denied-topic";

    await publishToKafka(deniedTopic, {
      action: "denied",
      requester_name: existing.requester_name,
      requester_email: existing.requester_email,
      net_name: existing.net_name,
      request_id: existing._id,
      reviewer_notes: reviewer_notes || null,
      reviewed_by: reviewed_by || null,
    });

    return result;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const reviewNetworkCreationRequest = async (request, next) => {
  try {
    const { query, body, params } = request;
    const tenant = query.tenant || constants.DEFAULT_TENANT || "airqo";
    const { request_id } = params;
    const { reviewer_notes, reviewed_by } = body;

    const existing = await NetworkCreationRequestModel(tenant)
      .findById(new ObjectId(request_id))
      .lean();

    if (!existing) {
      return {
        success: false,
        message: "Request not found",
        errors: { message: "No request found with the provided ID" },
        status: httpStatus.NOT_FOUND,
      };
    }

    return await NetworkCreationRequestModel(tenant).modify(
      {
        filter: { _id: new ObjectId(request_id) },
        update: {
          status: "under_review",
          reviewer_notes: reviewer_notes || null,
          reviewed_by: reviewed_by || null,
          reviewed_at: new Date(),
        },
      },
      next
    );
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

module.exports = {
  createNetworkCreationRequest,
  listNetworkCreationRequests,
  getNetworkCreationRequest,
  approveNetworkCreationRequest,
  denyNetworkCreationRequest,
  reviewNetworkCreationRequest,
};
