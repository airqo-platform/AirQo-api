from models.PMcamsDataModel import CamsDataController
from flask import request, jsonify


class PMcamsDataHandler:

    @staticmethod
    def get_pm25cams_data():
        controller = CamsDataController(
            db_name="airqo",
            table_name="cams_pm25",
            variable="pm2p5"
        )
        return controller.handle_request(request)

    @staticmethod
    def get_pm10cams_data():
        controller = CamsDataController(
            db_name="airqo",
            table_name="cams_pm10",
            variable="pm10"
        )
        return controller.handle_request(request)

    @staticmethod
    def get_pm10_tile_data(z: int, x: int, y: int):
        controller = CamsDataController(
            db_name="airqo",
            table_name="cams_pm10_tiles",
            variable="pm10"
        )
        return controller.get_pm10_tile(z, x, y)
