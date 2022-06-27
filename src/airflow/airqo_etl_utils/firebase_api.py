import datetime
import traceback
from typing import Any

import firebase_admin
import pandas as pd
from firebase_admin import credentials, messaging
from firebase_admin import firestore

from airqo_etl_utils.app_notification_utils import get_valid_name
from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import get_utc_offset_for_hour


class FirebaseApi:
    def __int__(self):
        cred = credentials.Certificate(configuration.GOOGLE_APPLICATION_CREDENTIALS)
        firebase_admin.initialize_app(cred)

    @staticmethod
    def get_valid_message_recipients(docs: Any) -> pd.DataFrame:
        recipients = []
        for doc in docs:
            user_info = dict(doc.to_dict())
            device = user_info.get("device", None)

            if device:
                recipient = {
                    "device": device,
                    "firstName": get_valid_name(user_info.get("firstName", "")),
                    "lastName": get_valid_name(user_info.get("lastName", "")),
                }
                recipients.append(recipient)

        recipients = pd.DataFrame(
            recipients, columns=["firstName", "lastName", "device"]
        )
        recipients.dropna(inplace=True)

        recipients["firstName"] = recipients["firstName"].apply(lambda x: x.title())
        recipients["lastName"] = recipients["lastName"].apply(lambda x: x.title())

        return recipients

    @staticmethod
    def get_notification_recipients_by_timezone_offset(
        hour: int,
        enabled_notifications: bool = True,
    ) -> pd.DataFrame:
        offset = get_utc_offset_for_hour(hour)
        docs = (
            firestore.client()
            .collection(configuration.APP_USERS_DATABASE)
            .where("utcOffset", "==", offset)
            .stream()
        )
        return FirebaseApi.get_valid_message_recipients(docs)

    @staticmethod
    def get_notification_recipients_by_countries(
        country_codes: list,
        enabled_notifications: bool = True,
    ) -> pd.DataFrame:
        recipients = pd.DataFrame()
        for code in country_codes:

            docs = (
                firestore.client()
                .collection(configuration.APP_USERS_DATABASE)
                .where("phoneNumber", ">=", code)
                .stream()
            )
            recipients = recipients.append(
                FirebaseApi.get_valid_message_recipients(docs), ignore_index=True
            )
        return recipients

    @staticmethod
    def get_notification_templates(template_name: str) -> list:
        value = (
            firestore.client()
            .collection(configuration.APP_NOTIFICATION_TEMPLATES_DATABASE)
            .document(template_name)
            .get()
            .to_dict()
        )
        return value["templates"]

    @staticmethod
    def send_notification_messages(messages: pd.DataFrame):
        print(f"Messages to be sent : {len(messages)}")

        notifications = []
        for _, message in messages.iterrows():
            notification = messaging.Message(
                notification=messaging.Notification(
                    title=message["message_title"], body=message["message_body"]
                ),
                token=message["device"],
                android=messaging.AndroidConfig(
                    ttl=datetime.timedelta(seconds=3600), priority="normal"
                ),
                data={"type": "notification"},
            )
            notifications.append(notification)

        for i in range(0, len(notifications), 500):
            messages = notifications[i : i + 500]

            try:
                for message in messages:
                    print(
                        f"Message to be sent to {message.token} =>  "
                        f"title : {message.notification.title} ; "
                        f"body : {message.notification.body}"
                    )
                response = messaging.send_all(messages)
                print(
                    f"{response.success_count} messages were sent successfully out of {len(messages)}"
                )
            except Exception as ex:
                print(ex)
                traceback.print_exc()
