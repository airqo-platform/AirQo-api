import requests

from config.constants import Config


def decode_user_token(token: str):
    user_details = {}

    try:
        token_details = requests.get(
            f"{Config.USERS_BASE_URL}/tokens/{token}?TOKEN={token}",
            headers={"Authorization": f"JWT {Config.JWT_TOKEN}"},
            timeout=5,
        ).json()["tokens"][0]
        user = token_details["user"]
        user_details["first_name"] = user.get("firstName", "")
        user_details["last_name"] = user.get("lastName", "")
        user_details["email"] = user.get("email", "")
        user_details["user_id"] = token_details.get("user_id", "")
    except Exception as ex:
        print(ex)

    return user_details
