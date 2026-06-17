"""HTTP view for active-fire outbreaks in Africa."""

import logging

from flask import jsonify, request

from models.active_fire_model import (
    ActiveFireConfigurationError,
    ActiveFireModel,
    ActiveFireUpstreamError,
    ActiveFireValidationError,
)


logger = logging.getLogger(__name__)


class ActiveFireView:
    @staticmethod
    def get_africa_active_fires():
        try:
            data = ActiveFireModel().fetch_africa_active_fires(
                source=request.args.get("source", ActiveFireModel.DEFAULT_SOURCE),
                day_range=request.args.get("day_range", 1),
                date=request.args.get("date"),
                min_confidence=request.args.get("min_confidence"),
                limit=request.args.get("limit"),
            )
            return jsonify({"message": "Operation successful", "data": data}), 200
        except ActiveFireValidationError as error:
            return jsonify({"error": str(error)}), 400
        except ActiveFireConfigurationError as error:
            return jsonify({"error": str(error)}), 503
        except ActiveFireUpstreamError as error:
            return jsonify({"error": str(error)}), 502
        except Exception:
            logger.exception("Failed to fetch Africa active fires")
            return (
                jsonify(
                    {
                        "error": "An internal error occurred while processing this request."
                    }
                ),
                500,
            )
