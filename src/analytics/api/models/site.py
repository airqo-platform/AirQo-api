from api.models.base.base_model import BasePyMongoModel

from main import cache


class SiteModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="sites")

    @cache.memoize()
    def get_sites(self, sites=None):
        if sites:
            return self.get_specific_sites(sites, id_key="site_id")

        return self.project(
            _id=0,
            site_id={"$toString": "$_id"},
            name=1,
            description=1,
            generated_name=1,
        ).exec()

    def get_specific_sites(self, sites, id_key="_id"):
        return (
            self.project(
                **{id_key: {"$toString": "$_id"}},
                name=1,
                description=1,
                generated_name=1
            )
            .match_in(**{id_key: sites})
            .exec()
        )

    @cache.memoize()
    def get_all_sites(self):
        return (
            self.lookup(
                "devices", local_field="_id", foreign_field="site_id", col_as="devices"
            )
            .add_stages(
                [
                    {
                        "$addFields": {
                            "devices": {
                                "$map": {
                                    "input": "$devices",
                                    "as": "device",
                                    "in": {
                                        "_id": {"$toString": "$$device._id"},
                                        "name": {"$toString": "$$device.name"},
                                    },
                                }
                            }
                        }
                    }
                ]
            )
            .exec(
                {
                    "_id": {"$toString": "$_id"},
                    "name": 1,
                    "description": 1,
                    "generated_name": 1,
                    "devices": {
                        "name": 1,
                        "_id": 1,
                    },
                }
            )
        )
