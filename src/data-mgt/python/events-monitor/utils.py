def build_slack_message(url, status_code, request_type, response_body, message):
    return dict({
        "text": {
            "type": "mrkdwn",
            "text": f"@channel, {message}"
        },
        "attachments": [
            {
                "fallback": f"{message}",
                "color": "#3067e2",
                "title": f"{message}",
                "fields": [
                    {
                        "title": "Url",
                        "value": f"{url}",
                    },
                    {
                        "title": "Request Type",
                        "value": f"{request_type}",
                    },
                    {
                        "title": "Response Status Code",
                        "value": f"{status_code}",
                    },
                    {
                        "title": "Response Body",
                        "color": "#3067e2",
                        "type": "mrkdwn",
                        "value": f"{str(response_body)}",
                    }
                ],
                "footer": "AirQo APIs",
            }
        ]
    })
