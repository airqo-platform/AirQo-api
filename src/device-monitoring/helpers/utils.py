from google.auth import jwt


def str_to_bool(string):
    return string.lower() in [
        "true",
        "1",
        "t",
        "y",
        "yes",
        "yeah",
        "yup",
        "certainly",
        "uh-huh",
    ]


def decode_user_token(auth_value: str):
    user_details = {}

    try:
        token = auth_value.split(" ")[1]
        decoded = jwt.decode(token, verify=False)
        user_details["first_name"] = decoded.get("firstName", "")
        user_details["last_name"] = decoded.get("lastName", "")
        user_details["email"] = decoded.get("email", "")
        user_details["id"] = decoded.get("_id", "")
    except:
        pass

    return user_details
