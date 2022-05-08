import datetime
import random
import traceback

import firebase_admin
import pandas as pd
from firebase_admin import credentials, messaging
from firebase_admin import firestore

from airqo_etl_utils.config import configuration
from airqo_etl_utils.date import get_utc_offset_for_hour, str_to_str_default
from airqo_etl_utils.utils import get_file_content, get_air_quality
from airqo_etl_utils.airqo_api import AirQoApi


def get_notification_recipients(hour: int) -> pd.DataFrame:

    cred = credentials.Certificate(configuration.GOOGLE_APPLICATION_CREDENTIALS)
    firebase_admin.initialize_app(cred)

    db = firestore.client()
    offset = get_utc_offset_for_hour(hour)
    docs = (
        db.collection(configuration.APP_USERS_DATABASE)
        .where("utcOffset", "==", offset)
        .stream()
    )
    recipients = []
    for doc in docs:
        user_info = dict(doc.to_dict())
        device = user_info.get("device", None)
        user_id = user_info.get("userId", None)
        recipient = dict()
        if device:
            recipient = {
                **{
                    "device": device,
                    "firstName": user_info.get("firstName", ""),
                    "lastName": user_info.get("lastName", ""),
                    "fav_places": [],
                }
            }

        if user_id:
            fav_places_docs = (
                db.collection(configuration.APP_USERS_FAV_PLACES_DATABASE)
                .document(user_id)
                .collection(user_id)
                .order_by("name", direction=firestore.firestore.Query.DESCENDING)
                .limit(3)
                .stream()
            )
            fav_places = []
            for fav_places_doc in fav_places_docs:
                fav_place_site_id = dict(fav_places_doc.to_dict()).get("siteId", None)
                fav_place_name = dict(fav_places_doc.to_dict()).get("name", None)
                if fav_place_site_id and fav_place_name:
                    fav_places.append(
                        {"siteId": fav_place_site_id, "name": fav_place_name}
                    )
            recipient["fav_places"] = fav_places

        recipients.append(recipient)

    return pd.DataFrame(recipients)


def get_notification_templates(hour: int) -> list:
    file = configuration.APP_NOTIFICATIONS_TEMPLATE
    template_content = get_file_content(file_name=file)
    if hour in range(0, 12):
        return template_content["morning"]
    elif hour in range(12, 3):
        return template_content["afternoon"]
    elif hour in range(3, 23):
        return template_content["evening"]
    else:
        return []


def get_latest_insights() -> list:
    airqo_api = AirQoApi()
    recent_events = airqo_api.get_events(
        tenant="airqo",
        start_time=None,
        end_time=None,
        recent=True,
        frequency="hourly",
        meta_data="site",
    )
    device_measurements = pd.json_normalize(recent_events)
    column_mappings = {
        "pm2_5.calibratedValue": "pm2_5",
        "pm10.calibratedValue": "pm10",
        "siteDetails._id": "siteId",
    }

    device_measurements.rename(columns=column_mappings, inplace=True)
    device_measurements = device_measurements[
        ["pm2_5", "pm10", "siteId", "time", "frequency"]
    ]
    device_measurements["time"] = device_measurements["time"].apply(
        lambda x: str_to_str_default(x)
    )
    return device_measurements.to_dict(orient="records")


def create_reminders(reminder_templates: dict, recipients: list) -> list:
    messages = []

    for recipient in recipients:
        message_index = random.randrange(len(reminder_templates))
        message = str(reminder_templates[message_index])

        recipient_first_name = recipient.get("firstName", "")
        recipient_last_name = recipient.get("lastName", "")
        name = recipient_first_name if recipient_first_name else recipient_last_name
        if name:
            message = message.replace("$NAME$", name)
            message = message.replace("$NAME$,", name)
        else:
            message = None

        if message:
            messages.append({"device": recipient.get("device"), "message": message})
    return messages


def create_updates(update_templates: dict, recipients: list, insights: list) -> list:
    messages = []

    for recipient in recipients:

        fav_places = recipient.get("fav_places", [])
        if not fav_places:
            continue

        message_index = random.randrange(len(update_templates))
        message = str(update_templates[message_index])
        places_updates = ""
        for fav_place in fav_places:
            fav_place_site_id = fav_place["siteId"]
            fav_place_readings = list(
                filter(lambda site: (site["siteId"] == fav_place_site_id), insights)
            )
            if fav_place_readings:
                air_quality = get_air_quality(pm2_5=fav_place_readings[0]["pm2_5"])
                place_update = f"{fav_place['name']} ({air_quality}), "
                places_updates = f"{places_updates}{place_update}"

        if places_updates:
            message = message.replace("$POLLUTION_UPDATE$", places_updates)
        else:
            message = None

        if message:
            message = message.strip()
            if message.endswith(","):
                message = f"{message[:len(message) - 1]}."
            messages.append({"device": recipient.get("device"), "message": message})
    return messages


def create_notification_messages(
    templates: list, recipients: pd.DataFrame, message_type=""
) -> pd.DataFrame:

    messages = []
    for _, recipient in recipients.iterrows():
        message_index = random.randrange(len(templates))
        message = str(templates[message_index])

        recipient_first_name = recipient["firstName"]
        recipient_last_name = recipient["lastName"]
        name = recipient_first_name if recipient_first_name else recipient_last_name

        message = message.replace("$NAME$", name)
        message = message.replace("$NAME$,", name)

        messages.append({"device": recipient["device"], "message": message})

    messages_df = pd.DataFrame(messages)
    messages_df.drop_duplicates(subset="device", keep="first", inplace=True)
    messages_df["type"] = message_type
    return messages_df


def create_notification_messages_(
    templates: dict, recipients: list, insights: list
) -> list:
    messages = []

    reminder_templates = templates.get("reminders")
    reminders = create_reminders(
        reminder_templates=reminder_templates, recipients=recipients
    )
    messages.extend(reminders)

    update_templates = templates.get("updates")
    updates = create_updates(
        update_templates=update_templates, recipients=recipients, insights=insights
    )
    messages.extend(updates)

    def shuffle_messages(repetition: int):
        random.shuffle(messages)
        if repetition < 3:
            shuffle_messages(repetition + 1)

    shuffle_messages(0)

    messages_df = pd.DataFrame(messages)
    messages_df.drop_duplicates(subset="device", keep="first", inplace=True)
    return messages_df.to_dict(orient="records")


def send_notification_messages(messages: pd.DataFrame):

    cred = credentials.Certificate(configuration.GOOGLE_APPLICATION_CREDENTIALS)
    firebase_admin.initialize_app(cred)

    notifications = []
    for _, message in messages.iterrows():
        notification = messaging.Message(
            notification=messaging.Notification(title="AirQo", body=message["message"]),
            token=message["device"],
            android=messaging.AndroidConfig(
                ttl=datetime.timedelta(seconds=3600), priority="normal"
            ),
            data={"type": message["type"]},
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
