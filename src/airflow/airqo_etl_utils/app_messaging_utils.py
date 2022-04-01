import datetime
import random
import traceback

import firebase_admin
from firebase_admin import credentials, messaging
from firebase_admin import firestore

from airqo_etl_utils.config import configuration
from airqo_etl_utils.utils import get_file_content


def get_notification_recipients() -> list:

    cred = credentials.Certificate(configuration.GOOGLE_APPLICATION_CREDENTIALS)
    firebase_admin.initialize_app(cred)

    db = firestore.client()

    users_ref = db.collection(configuration.APP_USERS_DATABASE)
    docs = users_ref.stream()
    recipients = []
    for doc in docs:
        user_info = dict(doc.to_dict())
        device = user_info.get("device", None)
        if device:
            recipients.append(
                {
                    "device": device,
                    "firstName": user_info.get("firstName", ""),
                    "lastName": user_info.get("lastName", ""),
                }
            )
    return recipients


def get_notification_template() -> list:
    file = configuration.APP_NOTIFICATIONS_TEMPLATE
    template_content = get_file_content(file_name=file)
    template = dict(template_content)
    return template.get("notifications", [])


def create_notification_messages(template: list, recipients: list) -> list:
    messages = []
    for recipient in recipients:
        message_index = random.randrange(len(template))
        message = str(template[message_index])

        recipient_first_name = recipient.get("firstName", "")
        recipient_last_name = recipient.get("lastName", "")

        if recipient_first_name:
            message = message.replace("$NAME$", recipient_first_name)
        elif recipient_last_name:
            message = message.replace("$NAME$", recipient_last_name)
        else:
            message = ""

        if message:
            messages.append({"device": recipient.get("device"), "message": message})

    return messages


def send_notification_messages(messages: list):

    cred = credentials.Certificate(configuration.GOOGLE_APPLICATION_CREDENTIALS)
    firebase_admin.initialize_app(cred)

    notifications = []
    for message in messages:

        notification = messaging.Message(
            notification=messaging.Notification(
                title="AirQo", body=message.get("message")
            ),
            token=message.get("device"),
            android=messaging.AndroidConfig(
                ttl=datetime.timedelta(seconds=3600),
                priority="normal"
            ),
        )
        notifications.append(notification)

    for i in range(0, len(notifications), 500):
        messages = notifications[i : i + 500]

        try:
            response = messaging.send_all(messages)
            print("{0} messages were sent successfully".format(response.success_count))
        except Exception as ex:
            print(ex)
            traceback.print_exc()
