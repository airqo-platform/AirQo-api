from api.models.base.base_model import BasePyMongoModel


class SiteModel(BasePyMongoModel):
    def __init__(self, tenant):
        super().__init__(tenant, collection_name="sites")

    def get_sites(self):
        return self.project(_id=0, site_id={"$toString": "$_id"}, name=1, description=1, generated_name=1).exec()

    def get_all_sites(self):
        return (
            self
            .lookup("devices", local_field="_id", foreign_field="site_id", col_as="devices")
            .add_stages(
                [{
                    "$addFields": {
                        "devices": {
                            "$map": {
                                "input": "$devices",
                                "as": "device",
                                "in": {
                                    "_id": {
                                        "$toString": "$$device._id"
                                    },
                                    "name": {
                                        "$toString": "$$device.name"
                                    }
                                }
                            }
                        }
                    }
                }]
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
                        }
                    }
            )
        )


