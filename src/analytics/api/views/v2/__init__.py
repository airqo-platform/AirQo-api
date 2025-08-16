from .dashboard import (
    ExceedancesResource,
    ExceedancesResource2,
    DailyAveragesResource,
    DailyAveragesResource2,
    ChartDataResource,
    MonitoringSiteResource,
)

from .data import (
    DataExportResource,
    DataSummaryResource,
    DataExportV2Resource,
    RawDataExportResource,
)

from main import rest_api_v2

rest_api_v2.add_resource(DataExportResource)
rest_api_v2.add_resource(DataSummaryResource)
rest_api_v2.add_resource(DataExportV2Resource)
rest_api_v2.add_resource(RawDataExportResource)
rest_api_v2.add_resource(ExceedancesResource)
rest_api_v2.add_resource(ExceedancesResource2)
rest_api_v2.add_resource(DailyAveragesResource)
rest_api_v2.add_resource(DailyAveragesResource2)
rest_api_v2.add_resource(ChartDataResource)
rest_api_v2.add_resource(MonitoringSiteResource)

__all__ = ["rest_api_v2"]
