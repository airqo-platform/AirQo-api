const mongoose = require("mongoose").set("debug", true);
const Schema = mongoose.Schema;

const { getCurrentTenantId } = require("./storage");

const tenantModel = (name, schema, options) => {
    return (props = {}) => {
        schema.add({ tenantId: String });
        const Model = mongoose.model(name, schema, options);

        const { skipTenant } = props;
        if (skipTenant) return Model;

        Model.schema.set("discriminatorKey", "tenantId");

        const tenantId = getCurrentTenantId();
        const discriminatorName = `${Model.modelName}-${tenantId}`;
        const existingDiscriminator = (Model.discriminators || {})[
            discriminatorName
        ];
        return (
            existingDiscriminator ||
            Model.discriminator(discriminatorName, new Schema({}))
        );
    };
};

const tenantlessModel = (name, schema, options) => {
    return () => mongoose.model(name, schema, options);
};

module.exports = { tenantModel, tenantlessModel };