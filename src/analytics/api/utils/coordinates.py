from random import random

DITHER = 0.001
DIFF = 0.6
DECIMAL_PLACES = 6


def approximate_coordinates(data):
	RANDOM_FLOAT = random()
	for item in data:
		if item.get("latitude"):
			item["latitude"] = round(item["latitude"] + (RANDOM_FLOAT-DIFF)*DITHER, DECIMAL_PLACES)

		if item.get("longitude"):
			item["longitude"] = round(item["longitude"] + (RANDOM_FLOAT-DIFF)*DITHER, DECIMAL_PLACES)

	return data
