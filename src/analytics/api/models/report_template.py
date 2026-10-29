"""
MongoDB model for report templates (collection: report_template).

Rebuild of the 2021-era Flask ReportTemplateModel on the framework-free
FastAPIPyMongoModel.  Two bugs in the original are fixed here:
  - it counted duplicates with PyMongo-3 ``cursor.count()`` (removed in
    PyMongo 4) — replaced with ``count_documents``;
  - its read projection ran ``$dateToString`` on ``$time``, a field the
    insert path never writes, so ``report_date`` always projected null —
    now reads ``$report_date``.

pymongo is synchronous: call these methods via asyncio.to_thread.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from api.models.base.mongo_base import FastAPIPyMongoModel

# Read shape returned for every template (exec stringifies _id).
_PROJECTION = {
    "_id": 1,
    "user_id": 1,
    "report_date": {
        "$dateToString": {
            "format": "%Y-%m-%dT%H:%M:%S%z",
            "date": "$report_date",
            "timezone": "Africa/Kampala",
        },
    },
    "report_type": 1,
    "report_name": 1,
    "report_body": 1,
}


class ReportTemplateModel(FastAPIPyMongoModel):
    def __init__(self, network: str):
        super().__init__(network, collection_name="report_template")

    def default_template_exists(self) -> bool:
        return self.collection.count_documents({"report_type": "default"}) > 0

    def insert_default(
        self, user_id: str, report_name: str, report_body: Dict[str, Any]
    ) -> None:
        self.insert(
            {
                "user_id": user_id,
                "report_date": datetime.now(timezone.utc),
                "report_type": "default",
                "report_name": report_name,
                "report_body": report_body,
            }
        )

    def insert_monthly(
        self, user_id: str, report_name: str, report_body: Dict[str, Any]
    ) -> None:
        self.insert(
            {
                "user_id": user_id,
                "report_date": datetime.now(timezone.utc),
                "report_name": report_name,
                "report_body": report_body,
            }
        )

    def get_default(self) -> Dict[str, Any]:
        """The default template, or {} when none exists (Flask contract)."""
        templates = list(self.filter_by(report_type="default").exec(dict(_PROJECTION)))
        return templates[0] if templates else {}

    def list_for_user(self, user_id: str) -> List[Dict[str, Any]]:
        return list(self.filter_by(user_id=user_id).exec(dict(_PROJECTION)))

    def update_default(self, update_fields: Dict[str, Any]):
        return self.update_one(
            filter_cond={"report_type": "default"}, update_fields=update_fields
        )

    def update_by_name(self, report_name: str, update_fields: Dict[str, Any]):
        return self.update_one(
            filter_cond={"report_name": report_name}, update_fields=update_fields
        )

    def delete_by_name(self, report_name: str):
        return self.delete_one({"report_name": report_name})
