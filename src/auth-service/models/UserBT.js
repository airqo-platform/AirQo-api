const constants = require("../config/constants");

const UserSchema = (value) => {
    return {
        [constants.COLUMN_FAMILY_ID]: {
            [constants.COLUMN_QUALIFIER]: {
                timeStamp: new Date(),
                value: value,
            },
        },
    };
};

module.exports = UserSchema;