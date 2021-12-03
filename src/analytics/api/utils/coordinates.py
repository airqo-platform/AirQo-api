from operator import pos, neg
from random import random, choice

DITHER = 0.001
DIFF = 0.6
DECIMAL_PLACES = 6
MIN_VALUE = 0.35
MAX_VALUE = 0.65


def biased_random(min_value=0.0, max_value=1.0):
	sign = choice([pos, neg])
	return sign(min_value + (max_value - min_value) * random())


def approximate_coordinates(data):
	RANDOM_MULTIPLIER = biased_random(min_value=MIN_VALUE, max_value=MAX_VALUE)

	for item in data:
		if item.get("latitude"):
			item["latitude"] = round(item["latitude"] + RANDOM_MULTIPLIER*DITHER, DECIMAL_PLACES)

		if item.get("longitude"):
			item["longitude"] = round(item["longitude"] + RANDOM_MULTIPLIER*DITHER, DECIMAL_PLACES)

	return data
