from main import rest_api_v3

from .data import DataExportResource, RawDataExportResource

rest_api_v3.add_resource(DataExportResource)
rest_api_v3.add_resource(RawDataExportResource)

__all__ = ["rest_api_v3"]
