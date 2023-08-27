import tweepy

from .config import configuration

client = tweepy.Client(
    bearer_token=configuration.TWITTER_BOT_BEARER_TOKEN,
    access_token=configuration.TWITTER_BOT_ACCESS_TOKEN,
    access_token_secret=configuration.TWITTER_BOT_ACCESS_TOKEN_SECRET,
    consumer_key=configuration.TWITTER_BOT_API_KEY,
    consumer_secret=configuration.TWITTER_BOT_API_KEY_SECRET,
)
auth = tweepy.OAuthHandler(
    access_token=configuration.TWITTER_BOT_ACCESS_TOKEN,
    access_token_secret=configuration.TWITTER_BOT_ACCESS_TOKEN_SECRET,
    consumer_key=configuration.TWITTER_BOT_API_KEY,
    consumer_secret=configuration.TWITTER_BOT_API_KEY_SECRET,
)

api = tweepy.API(auth)

def get_forecasts():
