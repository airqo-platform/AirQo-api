import argparse

from message_broker import MessageBroker

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--target",
        required=True,
        type=str.lower,
        choices=[
            "airqlouds-source-connector",
            "sites-source-connector",
            "devices-source-connector",
        ],
    )

    args = parser.parse_args()
    if args.target == "airqlouds-source-connector":
        MessageBroker.listen_to_airqlouds()

    elif args.target == "sites-source-connector":
        MessageBroker.listen_to_sites()

    elif args.target == "devices-source-connector":
        MessageBroker.listen_to_devices()
