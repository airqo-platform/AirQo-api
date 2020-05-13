import constants from "../config/constants";

const create = async(TABLE_ID, COLUMN_FAMILY_ID) => {
    const table = constants.BIGTABLE_INSTANCE.table(TABLE_ID);
    const [tableExists] = await table.exists();

    if (!tableExists) {
        const options = {
            families: [{
                name: COLUMN_FAMILY_ID,
                rule: {
                    versions: 1,
                },
            }, ],
        };
        await table.create(options);
    }
};

module.exports = create;