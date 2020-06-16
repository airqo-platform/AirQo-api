const { createNamespace } = require("continuation-local-storage");

const namespaceName = "request";
const ns = createNamespace(namespaceName);

const bindCurrentNamespace = (req, res, next) => {
    ns.bindEmitter(req);
    ns.bindEmitter(res);

    ns.run(() => {
        next();
    });
};

const setCurrentTenantId = (tenantId) => {
    return ns.set("tenantId", tenantId);
};

const getCurrentTenantId = () => {
    return ns.get("tenantId");
};

module.exports = {
    bindCurrentNamespace,
    setCurrentTenantId,
    getCurrentTenantId,
};