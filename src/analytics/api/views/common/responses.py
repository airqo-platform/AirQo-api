from typing import Dict, Tuple, List, Dict, Any, Optional
import flask_excel as excel
from api.utils.http import AirQoRequests
from requests import Response


class ResponseBuilder:
    @staticmethod
    def success(
        data: Any,
        metadata: Optional[Dict[str, Any]] = None,
        message: str = "Request successful",
    ) -> Tuple[Dict[str, Any], int]:
        return (
            AirQoRequests.create_response(message, data=data, metadata=metadata),
            AirQoRequests.Status.HTTP_200_OK,
        )

    @staticmethod
    def error(message: str, status: int = 400) -> Tuple[Dict[str, Any], int]:
        return AirQoRequests.create_response(message, success=False), status

    @staticmethod
    def csv(records: List[Dict[str, Any]], file_name: str) -> Response:
        return excel.make_response_from_records(records, "csv", file_name=file_name)
