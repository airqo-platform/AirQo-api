import datetime
import random
import traceback

import firebase_admin
import numpy as np
import pandas as pd
from firebase_admin import credentials, messaging
from firebase_admin import firestore

from .airqo_api import AirQoApi
from .constants import Tenant

from .config import configuration
from .date import get_utc_offset_for_hour

cred = credentials.Certificate(
    {
        "type": configuration.FIREBASE_TYPE,
        "project_id": configuration.FIREBASE_PROJECT_ID,
        "private_key_id": configuration.FIREBASE_PRIVATE_KEY_ID,
        "private_key": configuration.FIREBASE_PRIVATE_KEY.replace("\\n", "\n"),
        "client_email": configuration.FIREBASE_CLIENT_EMAIL,
        "client_id": configuration.FIREBASE_CLIENT_ID,
        "auth_uri": configuration.FIREBASE_AUTH_URI,
        "token_uri": configuration.FIREBASE_TOKEN_URI,
        "auth_provider_x509_cert_url": configuration.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        "universe_domain": configuration.FIREBASE_UNIVERSE_DOMAIN,
    }
)

firebase_admin.initialize_app(
    cred, {"databaseURL": configuration.FIREBASE_DATABASE_URL}
)

firestore_db = firestore.client()
__all__ = ["firestore_db"]
# users_ref = firestore_db.collection("airqo-app-users")


NOTIFICATION_TEMPLATE_MAPPER = {
    "monday_morning": "monday_morning",
    "friday_evening": "friday_evening",
    "weekday_morning": "weekday_morning",
    "weekday_evening": "weekday_evening",
    "weekend_morning": "weekend_morning",
    "weekend_evening": "weekend_evening",
}


def check_subscription(userId):
    try:
        user_ref = firestore_db.collection(
            configuration.FIREBASE_USERS_COLLECTION
        ).document(userId)
        user_doc = user_ref.get()

        if user_doc.exists:
            is_subscribed_to_email_notifs = user_doc.to_dict().get(
                "isSubscribedToEmailNotifs", True
            )

            return is_subscribed_to_email_notifs
        else:
            return False
    except Exception as error:
        print("Error checking subscription", error)
        return False


def get_all_users():
    try:
        if "staging" in configuration.AIRQO_BASE_URL_V2:
            print("Not sending push notifications in staging")
            return []
        all_users = []
        users_snapshot = firestore_db.collection(
            configuration.FIREBASE_USERS_COLLECTION
        ).get()
        for doc in users_snapshot:
            user_data = doc.to_dict()
            userId = user_data.get("userId")
            if userId is not None:
                is_subscribed = check_subscription(userId)
                if is_subscribed:
                    all_users.append(user_data)

        print(f"Number of users: : {len(all_users)}")

        return all_users
    except Exception as error:
        print("Error getting users")
        traceback.print_exc()
        raise (error)


def get_random_measurement():
    try:
        name, location, pm_value = None, None, None
        sites = AirQoApi().get_sites()
        while pm_value is None:
            random_index = random.randint(0, len(sites) - 1)
            target_place = sites[random_index]
            name = target_place.get("search_name")
            location = target_place.get("location_name")
            place_id = target_place.get("site_id")
            pm_value = AirQoApi().get_site_measurement(place_id)

        return pm_value, name, location, place_id
    except Exception as error:
        print("Error getting random measurement", error)
        traceback.print_exc()
        return None, None, None, None


def group_users(users):
    grouped_users = {}
    place_groupings = []
    try:
        for user in users:
            user_id = user.get("userId")
            name, location, pm_value, place_id = None, None, None, None
            place_groupings = AirQoApi().get_favorites(user_id)
            if len(place_groupings) == 0:
                place_groupings = AirQoApi().get_location_history(user_id)

                if len(place_groupings) == 0:
                    place_groupings = AirQoApi().get_search_history(user_id)

                    if len(place_groupings) == 0:
                        pm_value, name, location, place_id = get_random_measurement()

            if len(place_groupings) != 0:
                random_index = random.randint(0, len(place_groupings) - 1)
                target_place = place_groupings[random_index]

                name = target_place.get("name")
                location = target_place.get("location")
                pm_value = target_place.get("pm_value")
                place_id = target_place.get("place_id")

            if user["userId"] not in grouped_users:
                grouped_users[user["userId"]] = []

            grouped_users[user["userId"]].append(
                {
                    "name": name,
                    "location": location,
                    "pmValue": pm_value,
                    "placeId": place_id,
                }
            )

        return grouped_users
    except Exception as error:
        print("Error grouping Users for Push notifications", error)
        traceback.print_exc()
        return {"success": False, "error": error}


def send_push_notifications(grouped_users):
    for userId, user_locations in grouped_users.items():
        try:
            target_place = user_locations[0]

            if target_place["pmValue"] is not None:
                user_ref = firestore_db.collection(
                    configuration.FIREBASE_USERS_COLLECTION
                ).document(userId)
                user_doc = user_ref.get()

                if user_doc.exists:
                    registration_token = user_doc.to_dict().get("device")
                    name = user_doc.to_dict().get("firstName")
                    if name is None:
                        name = "there"
                    pm_value = target_place["pmValue"]
                    category = map_pm_values(pm_value)
                    message = map_notification_message(pm_value)

                    message = messaging.Message(
                        notification=messaging.Notification(
                            title=f"Concentration level: {pm_value:.2f} µg/m3!",
                            body=f"Hey {name}, {target_place['name']}'s air quality is {category}. {message}",
                        ),
                        data={
                            "subject": "daily_air_quality",
                            "site": target_place["placeId"],
                        },
                        token=registration_token,
                    )

                    response = messaging.send(message)
                    print(f"Successfully sent message to User {userId}: {response}")
                else:
                    print(f"User {userId} document does not exist")

            else:
                print(f"No PM value while sending push notifications to User {userId}")
        except Exception as error:
            print(f"Error sending push notifications to User {userId}", error)
            traceback.print_exc()


def map_pm_values(pm_value):
    if pm_value <= 12:
        return "Good"
    elif pm_value > 12 and pm_value <= 35.4:
        return "Moderate"
    elif pm_value > 35.4 and pm_value <= 55.4:
        return "Unhealthy for sensitive groups"
    elif pm_value > 55.4 and pm_value <= 150.4:
        return "Unhealthy"
    elif pm_value > 150.4 and pm_value <= 250.4:
        return "Very Unhealthy"
    else:
        return "Hazardous"

def map_notification_message(pm_value):
    if pm_value <= 12:
        return "Enjoy the outdoors and have a great day!"
    elif pm_value > 12 and pm_value <= 35.4:
        return "Today is a great day for outdoor activity."
    elif pm_value > 35.4 and pm_value <= 55.4:
        return "People with respiratory issues may experience discomfort due to air quality. Minimize time spent outdoors."
    elif pm_value > 55.4 and pm_value <= 150.4:
        return "Avoid activities that make you breathe more rapidly. Today is the perfect day to spend indoors reading."
    elif pm_value > 150.4 and pm_value <= 250.4:
        return "Reduce the intensity of your outdoor activities. Try to stay indoors until the air quality improves."
    else:
        return "If you have to spend a lot of time outside, disposable masks like the N95 are helpful."

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
