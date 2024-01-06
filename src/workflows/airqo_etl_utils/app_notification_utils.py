import datetime
import random
import traceback

import firebase_admin
import numpy as np
import pandas as pd
from firebase_admin import credentials, messaging
from firebase_admin import firestore

from .config import configuration
from .date import get_utc_offset_for_hour

cred = credentials.Certificate(configuration.GOOGLE_APPLICATION_CREDENTIALS)
firebase_admin.initialize_app(cred)

NOTIFICATION_TEMPLATE_MAPPER = {
    "monday_morning": "monday_morning",
    "friday_evening": "friday_evening",
    "weekday_morning": "weekday_morning",
    "weekday_evening": "weekday_evening",
    "weekend_morning": "weekend_morning",
    "weekend_evening": "weekend_evening",
}


def get_valid_name(name):
    try:
        name = int(name)
    except:
        pass

    if not isinstance(name, str) or name.strip() == "" or name == np.nan:
        return ""
    return name


def get_notification_recipients(
    hour: int,
    enabled_notifications: bool = True,
) -> pd.DataFrame:
    offset = get_utc_offset_for_hour(hour)
    db = firestore.client()
    docs = (
        db.collection(configuration.APP_USERS_DATABASE)
        .where("utcOffset", "==", offset)
        .stream()
    )
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

    recipients = pd.DataFrame(recipients)
    recipients.dropna(inplace=True)

    recipients["firstName"] = recipients["firstName"].apply(lambda x: x.title())
    recipients["lastName"] = recipients["lastName"].apply(lambda x: x.title())

    return recipients


def get_notification_templates(template_name: str) -> list:
    db = firestore.client()
    value = (
        db.collection(configuration.APP_NOTIFICATION_TEMPLATES_DATABASE)
        .document(template_name)
        .get()
        .to_dict()
    )
    return value["templates"]


def create_notification_messages(
    templates: list,
    recipients: pd.DataFrame,
) -> pd.DataFrame:
    messages = []
    recipients.fillna("", inplace=True)
    for _, recipient in recipients.iterrows():
        message_index = random.randrange(len(templates))
        message_template = dict(templates[message_index])

        recipient_first_name = recipient["firstName"]
        recipient_last_name = recipient["lastName"]

        name = ""
        if recipient_first_name or recipient_last_name:
            name = recipient_first_name if recipient_first_name else recipient_last_name

        message_title = message_template["title"]
        message_body = message_template["body"]

        message_title = message_title.replace("$NAME$", name)

        if "$" not in str(message_title) and "$" not in str(message_body):
            messages.append(
                {
                    "device": recipient["device"],
                    "message_title": message_title,
                    "message_body": message_body,
                }
            )

    messages_df = pd.DataFrame(messages)
    messages_df.drop_duplicates(subset="device", keep="first", inplace=True)
    return messages_df


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
