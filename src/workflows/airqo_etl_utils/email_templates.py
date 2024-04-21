import os

from .config import configuration


image_dir = os.path.join(os.path.dirname(__file__), "../config/images")

def forecast_email(places, userID, userEmail):
    unSubscriptionUrl = configuration.unsubscribe_url(userEmail, userID)
    footerTemplate = email_footer_template(userEmail, unSubscriptionUrl)
    favoritesContent = ""

    for place in places:
        forecast_air_quality_levels = place.get("forecast_air_quality_levels", [])
        forecast_air_quality_levels = [level.lower() for level in forecast_air_quality_levels]
        for level in forecast_air_quality_levels:
            if level =="unhealthy for sensitive groups":
                level = "uhfsg"
            if level == "very unhealthy":
                level = "veryUnhealthy"
            
        
        days = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

        favoritesContent += f"""
            <!-- Location Content -->
            <table style="width: 100%; text-align: center; background-color: #fff;">
                <tr style="border: 1px #EBF1FF solid;">
                    <td style="text-align: center; padding: 10px;"><img src="cid:FavoriteIcon" style="height: 24px; width: 24px;"></td>
                    <td>
                        <div style="text-align: start; width: 200px; color: black; font-size: 16px; font-family: Inter; font-weight: 700; line-height: 20px; word-wrap: break-word">{place['name']}</div>
                        <div style="text-align: start; width: 200px; font-size: 14px; font-family: Inter; font-weight: 500; line-height: 20px; color: #8D8D8D;">{place['location']}</div>
                    </td>
                    <td style="text-align: center; padding: 10px; display: grid; place-items: center;">
                        <div style="width: 80px; background: #145DFF; border-radius: 6.09px; display: grid; align-content: center; justify-content: center; color: white; font-size: 14px; padding-top: 9.13px; padding-bottom: 9.13px;">View now</div>
                    </td>
                </tr>
            </table><br/>
            <!-- Insights Calendar -->
            <div style="border: 2px solid #EBF1FF; width: 80%; margin-left: 50px; display:flex; place-content: center;">
                <table style="width: 60%; padding: 30px; display: revert; padding-left: 40px;">
                    <tr>{"".join([f"<td>{day}</td>" for day in days])}</tr>
                    <tr>{"".join([f"<td><div style='height: 22.30px; position: relative; place-content: center; display: flex; padding-right: 5px;'><img src='cid:{level}Emoji' style='height: 24px; width: 24px;'></div></td>" for level in forecast_air_quality_levels])}</tr>
                </table>
            </div>
            <br/>
            <br/>
        """

    scale = [
    {"emoji": "goodEmoji", "level_name": "Good"},
    {"emoji": "moderateEmoji", "level_name": "Moderate"},
    {"emoji": "uhfsgEmoji", "level_name": "Unhealthy for Sensitive Groups"},
    {"emoji": "unhealthyEmoji", "level_name": "Unhealthy"},
    {"emoji": "veryUnhealthyEmoji", "level_name": "Very Unhealthy"},
    {"emoji": "hazardousEmoji", "level_name": "Hazardous"}
            ]

    scaleContent = '<div style="margin-left: 50px; text-align: start; width: 200px; color: black; font-size: 16px; font-family: Inter; font-weight: 700; line-height: 20px; word-wrap: break-word">Air Quality Scale</div>'
    scaleContent += "<ul style='list-style-type: none;'>"
    for item in scale:
        scaleContent += f"<li><img src='cid:{item['emoji']}' style='height: 24px; width: 24px;'> -{item['level_name']}</li>"
    scaleContent += "</ul>"



    return f"""<!DOCTYPE html>
    <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0;font-family:Arial, sans-serif;">
            <div style="width: 90%; height: 100%; padding: 32px; background: #F3F6F8;">
                <!-- Email content container with white background -->
                <table style="width: 100%; max-width: 1024px; margin: 0 auto; background: white;border-top-left-radius: 30px;border-top-right-radius: 30px;">
                    <tr>
                        <td>
                            <table style="width: 100%; background-color: #145DFF; border-top-left-radius: 30.46px;border-top-right-radius: 30.46px;">
                                <tr>
                                    <td style="text-align: center; border-top-left-radius: 30.46px; border-top-right-radius: 30.46px;">
                                        <!-- Logo goes here -->
                                        <img src="cid:AirQoEmailLogoAlternate" alt="logo" style="height: 100px; margin-right: 10px;">
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 24px;">
                            <!-- Email content section -->
                            <table style="width: 100%;">
                                <tr>
                                    <td>
                                        <table style="width: 100%; text-align: center; background-color: #fff;">
                                            <tr>
                                                <td>
                                                    <br />
                                                    <div style="text-align: center; color: #121723; font-size: 36.75px; font-family: Inter; font-weight: 500; line-height: 50px; word-wrap: break-word">
                                                        Peek Into Your Favorites' Air Quality This Week</div>
                                                    <br />
                                                </td>
                                            </tr>
                                        </table>
                                        {favoritesContent}
                                        {scaleContent}
                                        <br />
                                        <br />
                                        <tr>
                                            <td style=" height: 8px; background: #EBF1FF;"></td>
                                        </tr>
                                    </td>
                                </tr>
                            </table>
                            <!-- Social media section -->
                            {footerTemplate}
                        </td>
                    </tr>
                </table>
            </div>
        </body>
    </html> """


def email_greetings(name):
    if name:
        return f"""<tr>
                                <td
                                    style="padding-bottom: 24px; color: #344054; font-size: 16px; font-family: Inter; font-weight: 600; line-height: 24px; word-wrap: break-word;">
                                    Dear {name},
                                </td>
                            </tr>"""
    else:
        return ""


def email_header_template():
    return """
    <table style="width: 100%; padding-bottom: 24px;">
        <tr>
            <td style="display: flex; align-items: center;">
                <img src="cid:AirQoEmailLogo" alt="logo" style="height: 48px; width: 71px; margin-right: 10px;">
            </td>
        </tr>
    </table>
    """


def email_footer_template(email, unSubscriptionUrl=None):
    unsubscribeSection = f"""<span
        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
        <a href="{unSubscriptionUrl}" style="color: #135DFF; text-decoration: none;">unsubscribe</a>
    </span>""" if unSubscriptionUrl else """<span
        style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
        unsubscribe</span>"""

    return f"""
    <table style="width: 100%; text-align: center; padding-top: 32px; padding-bottom: 32px;">
        <tr>
            <td>
                <a href="https://www.facebook.com/AirQo/" target="_blank"><img
                        src="cid:FacebookLogo" alt="FacebookLogo"
                        style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                <a href="https://www.youtube.com/@airqo7875" target="_blank"><img
                        src="cid:YoutubeLogo" alt="YoutubeLogo"
                        style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                <a href="https://www.linkedin.com/company/airqo/" target="_blank"><img
                        src="cid:LinkedInLogo" alt="LinkedInLogo"
                        style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
                <a href="https://twitter.com/AirQoProject" target="_blank"><img src="cid:Twitter"
                        alt="Twitter"
                        style="width: 24px; height: 24px; margin-right: 20px; border-radius: 50%;"></a>
            </td>
        </tr>
    </table>

    <!-- Footer section -->
    <table style="width: 100%; text-align: center;">
        <tr>
            <td>
                <span
                    style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">This
                    email was sent to</span>
                <span
                    style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">{email}</span>
                <span
                    style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
                    . If you'd rather not receive this kind of email, you can </span>
               {unsubscribeSection}
                <span
                    style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">
                    or </span>
                <span
                    style="color: #135DFF; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">manage
                    your email preferences.</span><br /><br />
                <span
                    style="color: #667085; font-size: 14px; font-family: Inter; font-weight: 400; line-height: 20px; word-wrap: break-word;">©
                    2023 AirQo<br /><br />
                    Makerere University, Software Systems Centre, Block B, Level 3, College of
                    Computing and
                    Information Sciences, Plot 56 University Pool Road</span>
            </td>
        </tr>
    </table>
    """


def email_body(email, content, name=None):
    footerTemplate = email_footer_template(email)
    headerTemplate = email_header_template()
    greetings = email_greetings(name) if name else ""
    
    return f"""<!DOCTYPE html>
<html>

    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>

    <body style="margin: 0; padding: 0;font-family:Arial, sans-serif;">

        <div style="width: 90%; height: 100%; padding: 32px; background: #F3F6F8;">
            <!-- Email content container with white background -->
            <table style="width: 100%; max-width: 1024px; margin: 0 auto; background: white;">
                <tr>
                    <td style="padding: 24px;">
                        <!-- Logo and title section -->
                         {headerTemplate}

                        <!-- Email content section -->
                        <table style="width: 100%;">
                           {greetings}
                            {content}
                            <tr>
                                <td style=" height: 8px; background: #EBF1FF;"></td>
                            </tr>
                        </table>

                        <!-- Social media section -->
                        {footerTemplate}
                    </td>
                </tr>
            </table>
        </div>

    </body>

</html>"""
