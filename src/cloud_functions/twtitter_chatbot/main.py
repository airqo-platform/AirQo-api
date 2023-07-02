import os
import tweepy
from dotenv import load_dotenv
from models import Events
import random

load_dotenv()

API_KEY = os.getenv("AIRQO_BOT_API_KEY")
API_KEY_SECRET = os.getenv("AIRQO_BOT_API_KEY_SECRET")
BEARER_TOKEN = os.getenv("AIRQO_BOT_BEARER_TOKEN")
ACCESS_TOKEN = os.getenv("AIRQO_BOT_ACCESS_TOKEN")
ACCESS_TOKEN_SECRET = os.getenv("AIRQO_BOT_ACCESS_TOKEN_SECRET")
client = tweepy.Client(bearer_token=BEARER_TOKEN, access_token=ACCESS_TOKEN, access_token_secret=ACCESS_TOKEN_SECRET,
                       consumer_key=API_KEY, consumer_secret=API_KEY_SECRET)
auth = tweepy.OAuthHandler(access_token=ACCESS_TOKEN, access_token_secret=ACCESS_TOKEN_SECRET, consumer_key=API_KEY,
                           consumer_secret=API_KEY_SECRET)

api = tweepy.API(auth)

# client.create_tweet(text="AirQo, Breathe Clean!")

if __name__ == "__main__":
    site = random.choice(Events.fetch_sites())
    forecasts = Events.fetch_forecasts(site)
    templates = [
        "Good morning! Today in [LOCATION], the PM2.5 level is [PM25_LEVEL]. Remember to take necessary precautions and stay informed. [HEALTH_TIP]",
        "Attention [LOCATION] residents! The current PM2.5 level is [PM25_LEVEL], which indicates [AIR_QUALITY]. Take necessary precautions and protect your health. [HEALTH_TIP]",
    ]

    template = random.choice(templates)
    location = site['site_codes'][1]
    pm2_5 = forecasts[0]['pm2_5']
    health_tip = forecasts[0]['health_tip']

    tweet = template.replace("[LOCATION]", location).replace("[PM25_LEVEL]", pm2_5).replace("[HEALTH_TIP]", health_tip)

    client.create_tweet(tweet)
