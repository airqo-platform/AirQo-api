from config import connect_mongo


class AdminLevel:
    """
    The class handles functionality for accessing data for the administrative levels.

    """

    def __init__(self, tenant):
        self.db = connect_mongo(tenant)

    def get_administrative_level_map(self, polygon):
        """
        Gets all the administrative level instances in a given polygon e.g parishes
        """
        if polygon == None:
            return "Please select a polygon"
        else:
            try:
                query = {
                    "geometry": {
                        "$geoWithin": {
                            "$geometry": {"type": "Polygon", "coordinates": polygon}
                        }
                    }
                }
                projection = {"_id": 0}

                records = self.db.locate_data.find(query, projection)
                records_list = list(records)
                print(records_list[0])
                return records_list
            except:
                return "Invalid polygon"

    def get_administrative_region_for_point(self, point):
        """
        Gets the administrative region/level in which the given coordinates belong
        """
        query = {
            "geometry": {
                "$geoIntersects": {"$geometry": {"type": "Point", "coordinates": point}}
            }
        }
        projection = {"_id": 0}
        records = self.db.locate_data.find(query, projection)
        records_list = list(records)
        return records_list

    def get_sample_location_data(self):
        query = {""}
        projection = {"_id": 0, "geometry": 0}
        records = list(self.db.locate_data.find({}, projection).limit(3))
        print(len(records))
        return records

    if __name__ == "__main__":
        admin_level_instance = AdminLevel(tenant="airqo")
        results = admin_level_instance.get_sample_location_data()
