import datetime
import random
import traceback

import firebase_admin
import numpy as np
import pandas as pd

from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib

from firebase_admin import credentials, messaging
from firebase_admin import firestore
from firebase_admin.exceptions import NotFoundError

from airqo_etl_utils.data_api import DataApi
from .config import configuration as Config
from .datautils import DataUtils
from .meta_data_utils import MetaDataUtils

from .date import get_utc_offset_for_hour
from .email_templates import forecast_email
from typing import Tuple, Optional
import logging

logger = logging.getLogger("airflow.task")

cred = credentials.Certificate(
    {
        "type": Config.FIREBASE_TYPE,
        "project_id": Config.FIREBASE_PROJECT_ID,
        "private_key_id": Config.FIREBASE_PRIVATE_KEY_ID,
        "private_key": Config.FIREBASE_PRIVATE_KEY.replace("\\n", "\n"),
        "client_email": Config.FIREBASE_CLIENT_EMAIL,
        "client_id": Config.FIREBASE_CLIENT_ID,
        "auth_uri": Config.FIREBASE_AUTH_URI,
        "token_uri": Config.FIREBASE_TOKEN_URI,
        "auth_provider_x509_cert_url": Config.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
        "universe_domain": Config.FIREBASE_UNIVERSE_DOMAIN,
    }
)

firebase_admin.initialize_app(cred, {"databaseURL": Config.FIREBASE_DATABASE_URL})

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


def check_subscription(user_doc, notifications_type):
    try:
        user_data = user_doc.to_dict()
        is_subscribed_to_notifs = user_data.get("isSubscribedtoNotifs", {})
        is_subscribed_to_notifs = is_subscribed_to_notifs.get(notifications_type, True)

        return is_subscribed_to_notifs

    except Exception as error:
        print("Error checking subscription", error)
        return False


def get_all_users(notifications_type):
    try:
        all_users = []
        users_snapshot = firestore_db.collection(Config.FIREBASE_USERS_COLLECTION).get()
        for user_doc in users_snapshot:
            user_data = user_doc.to_dict()
            userId = user_data.get("userId")
            userEmail = user_data.get("emailAddress")
            user_token = user_data.get("device")
            if notifications_type == "email":
                if userEmail == "":
                    continue
            if userId is not None:
                is_subscribed = check_subscription(user_doc, notifications_type)
                has_token = user_token is not None and user_token.strip() != ""
                if is_subscribed and has_token:
                    all_users.append(user_data)

        print(f"Number of users: : {len(all_users)}")

        return all_users
    except Exception as error:
        print("Error getting users")
        traceback.print_exc()
        raise (error)


def get_random_measurement() -> Tuple[
    Optional[float], Optional[str], Optional[str], Optional[str]
]:
    """
    Retrieve a random site measurement with a valid pm_value.

    This function obtains the sites DataFrame via DataUtils.get_sites() and then attempts to
    retrieve a valid (non-NaN) pm_value for a randomly selected site. It repeatedly samples
    random rows up to a maximum number of attempts equal to the number of rows in the DataFrame.
    If no valid measurement is found after all attempts, a warning is logged and the default
    values (None) are returned.

    The measurement for a site is fetched using AirQoApi().get_site_measurement(place_id),
    where 'place_id' is obtained from the site's data.

    Returns:
        tuple:
            - pm_value (Optional[float]): The measurement value if valid; otherwise, None.
            - name (Optional[str]): The site's search name.
            - location (Optional[str]): The site's location name.
            - place_id (Optional[str]): The site's identifier.
    """
    try:
        sites = MetaDataUtils.extract_sites()
        sites.rename(columns={"id": "site_id"}, inplace=True)
        data_api = DataApi()
        max_attempts = len(sites)
        attempt = 0
        pm_value, name, location, place_id = None, None, None, None

        while (pm_value is None or pd.isna(pm_value)) and attempt < max_attempts:
            target_place = sites.sample(n=1).iloc[0]
            name = target_place.get("display_name")
            location = target_place.get("display_location")
            place_id = target_place.get("site_id")
            pm_value = data_api.get_site_measurement(place_id)
            attempt += 1

        if pm_value is None or pd.isna(pm_value):
            logger.warning("No valid measurement found after maximum attempts.")
        return pm_value, name, location, place_id

    except Exception as e:
        logger.exception("Error getting random measurement", exc_info=e)
        return None, None, None, None


def group_users(users, reading_type):
    grouped_users = {}
    place_groupings = []
    data_api = DataApi()
    try:
        for user in users:
            user_id = user.get("userId")
            name, location, pm_value, place_id, forecast_air_quality_levels = (
                None,
                None,
                None,
                None,
                None,
            )
            place_groupings = data_api.get_favorites(user_id)
            if len(place_groupings) == 0:
                place_groupings = data_api.get_location_history(user_id)

                if len(place_groupings) == 0:
                    place_groupings = data_api.get_search_history(user_id)

            if len(place_groupings) != 0:
                random_index = random.randint(0, len(place_groupings) - 1)
                target_place = place_groupings[random_index]

                name = target_place.get("name")
                location = target_place.get("location")
                pm_value = target_place.get("pm_value")
                place_id = target_place.get("place_id")

            if reading_type == "forecast":
                forecasts = data_api.get_forecast(frequency="daily", site_id=place_id)
                if len(forecasts) == 0:
                    continue
                pm_values = [forecast["pm2_5"] for forecast in forecasts]
                forecast_air_quality_levels = [
                    map_pm_values(pm_value) for pm_value in pm_values
                ]
                pm_value = pm_values[0]

            if user["userId"] not in grouped_users:
                grouped_users[user["userId"]] = []

            grouped_users[user["userId"]].append(
                {
                    "name": name,
                    "location": location,
                    "pmValue": pm_value,
                    "placeId": place_id,
                    "forecast_air_quality_levels": forecast_air_quality_levels,
                    "email": user.get("emailAddress"),
                    "userToken": user.get("device"),
                    "userName": user.get("firstName") or "there",
                }
            )
        print("Grouped Users: ", grouped_users)
        return grouped_users
    except Exception as error:
        print("Error grouping Users", error)
        traceback.print_exc()
        return {"success": False, "error": error}


def send_push_notifications(grouped_users):
    for userId, user_locations in grouped_users.items():
        try:
            target_place = user_locations[0]

            if target_place["pmValue"] is not None:
                user_token = target_place["userToken"]
                name = target_place["userName"]
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
                    token=user_token,
                )

                response = messaging.send(message)
                print(f"Successfully sent message to User {userId}: {response}")

            else:
                print(f"No PM value while sending push notifications to User {userId}")

        except NotFoundError as e:
            user_ref = firestore_db.collection(
                Config.FIREBASE_USERS_COLLECTION
            ).document(userId)
            user_ref.update({"device": ""})
            print(f"Token for User {userId} is invalid and has been deleted.")

        except Exception as error:
            print(f"Error sending push notifications to User {userId}", error)
            traceback.print_exc()


def send_email_notifications(grouped_users):
    try:
        for user_id, target_places in grouped_users.items():
            place = target_places[0]
            pm_value = place.get("pmValue")
            attachments = Config.ATTACHMENTS.get(
                "EMOJI_ATTACHMENTS"
            ) + Config.ATTACHMENTS.get("EMAIL_ATTACHMENTS")

            user_email = place.get("email")

            mail_options = {
                "from": {
                    "name": "AirQo Data Team",
                    "address": Config.MAIL_USER,
                },
                "to": user_email,
                "subject": "Air quality of {} is expected to be {} with a concentration level of {:.2f}µg/m3!".format(
                    place.get("name"), map_pm_values(pm_value), pm_value
                ),
                "html": forecast_email(target_places, user_id, user_email),
                "attachments": attachments,
            }

            try:
                server = smtplib.SMTP("smtp.gmail.com", 587)
                server.starttls()
                server.login(Config.MAIL_USER, Config.MAIL_PASS)

                msg = MIMEMultipart()
                msg["From"] = mail_options["from"]["address"]
                msg["To"] = mail_options["to"]
                msg["Subject"] = mail_options["subject"]

                msg.attach(MIMEText(mail_options["html"], "html"))

                for attachment in mail_options["attachments"]:
                    with open(attachment["path"], "rb") as f:
                        image = MIMEImage(f.read())
                    image.add_header(
                        "Content-Disposition",
                        f'attachment; filename="{attachment["filename"]}"',
                    )
                    image.add_header("Content-ID", f'<{attachment["cid"]}>')
                    msg.attach(image)

                server.sendmail(
                    mail_options["from"]["address"], mail_options["to"], msg.as_string()
                )
                server.quit()
                print("New Email notification sent to ", user_email)
            except Exception as error:
                print("Transporter failed to send email", error)
    except Exception as error:
        print("Forecast Favorites Email sending failed", error)


def add_attachment(attachments_list, filename, path, cid):
    attachment_dict = {"filename": filename, "path": path, "cid": cid}
    if attachment_dict not in attachments_list:
        attachments_list.append(attachment_dict)


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
        db.collection(Config.APP_USERS_DATABASE)
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
        db.collection(Config.APP_NOTIFICATION_TEMPLATES_DATABASE)
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
    logger.info(f"Messages to be sent : {len(messages)}")

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
            response = messaging.send_all(messages)
            logger.info(
                f"{response.success_count} messages were sent successfully out of {len(messages)}"
            )
        except Exception as ex:
            logger.exception(f"An exception occurred: {ex}")
