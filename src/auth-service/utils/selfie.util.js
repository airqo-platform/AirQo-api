const SelfieModel = require("@models/Selfie");
const GuestUserModel = require("@models/GuestUser");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const { generateFilter, generateGuestIdentity } = require("@utils/common");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- selfie-util`);

function extractCloudinaryPublicId(imageUrl) {
  try {
    const url = new URL(imageUrl);
    const match = url.pathname.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z0-9]+$/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

async function destroyCloudinaryAsset(publicId) {
  if (!publicId) {
    return;
  }
  const isCloudinaryConfigured =
    !!constants.CLOUD_NAME &&
    !!constants.CLOUDINARY_API_KEY &&
    !!constants.CLOUDINARY_API_SECRET;

  if (!isCloudinaryConfigured) {
    logger.warn(
      `Cloudinary not configured — skipping asset deletion for ${publicId}`
    );
    return;
  }

  try {
    const cloudinary = require("@config/cloudinary");
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    logger.error(
      `🐛🐛 Failed to delete Cloudinary asset ${publicId} -- ${error.message}`
    );
  }
}

async function resolveSubmitterIdentity({ request, tenant, body }) {
  if (request.user && request.user._id) {
    return {
      user_id: request.user._id,
      displayName: body.displayName || request.user.userName,
      avatarIcon: body.avatarIcon,
      guest_id: undefined,
    };
  }

  if (body.guest_id) {
    const guestUser = await GuestUserModel(tenant)
      .findOne({ guest_id: body.guest_id })
      .lean();

    if (!isEmpty(guestUser)) {
      GuestUserModel(tenant)
        .modify({
          filter: { guest_id: body.guest_id },
          update: { lastActive: new Date() },
        })
        .catch((error) => {
          logger.error(
            `🐛🐛 Internal Server Error while touching guest lastActive -- ${error.message}`
          );
        });

      return {
        user_id: undefined,
        guest_id: guestUser.guest_id,
        displayName: body.displayName || guestUser.displayName,
        avatarIcon: body.avatarIcon || guestUser.avatarIcon,
      };
    }
    // stale/unknown guest_id -- fall through to a fresh anonymous identity
  }

  const identity = generateGuestIdentity();
  return {
    user_id: undefined,
    guest_id: undefined,
    displayName: body.displayName || identity.displayName,
    avatarIcon: body.avatarIcon || identity.avatarIcon,
  };
}

const selfie = {
  create: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = { ...body, ...query };

      const identity = await resolveSubmitterIdentity({
        request,
        tenant,
        body,
      });

      const response = await SelfieModel(tenant).register(
        {
          ...body,
          ...identity,
        },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, limit, skip } = query;
      const filter = generateFilter.selfies(request, next);

      const response = await SelfieModel(tenant).list(
        { skip, limit, filter },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  hide: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, id } = { ...query, ...params };

      const response = await SelfieModel(tenant).modify(
        {
          filter: { _id: id },
          update: {
            $set: {
              hidden: true,
              hiddenAt: new Date(),
              hiddenBy: request.user && request.user._id,
            },
          },
        },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      const { query, params } = request;
      const { tenant, id } = { ...query, ...params };

      const existing = await SelfieModel(tenant).findOne({
        filter: { _id: id },
      });

      if (!existing || existing.success === false) {
        return existing;
      }

      const publicId = extractCloudinaryPublicId(existing.data.imageUrl);
      await destroyCloudinaryAsset(publicId);

      const response = await SelfieModel(tenant).remove(
        { filter: { _id: id } },
        next
      );

      return response;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = selfie;
