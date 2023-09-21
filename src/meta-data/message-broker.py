import argparse
import json
import traceback

from kafka import KafkaConsumer

from airqo_api import AirQoApi
from api.helpers.validation import remove_invalidate_meta_data_values
from config import Config
from api.models import extract as ext


class MessageBroker:
    @staticmethod
    def listen_to_created_sites():
        airqo_api = AirQoApi()
        consumer = KafkaConsumer(
            Config.SITES_TOPIC,
            bootstrap_servers=Config.BOOTSTRAP_SERVERS,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
        )
        model = ext.Extract()

        print("Listening to created sites.....")

        for msg in consumer:
            try:
                site = msg.value
                print(f"\nReceived site : {site}")
                data_is_valid = True

                for field in ["latitude", "longitude", "_id"]:
                    if not site.get(field, None):
                        print(f"Error : {field} is missing in site details")
                        data_is_valid = False

                if not data_is_valid:
                    continue

                site_latitude = site.get("latitude")
                site_longitude = site.get("longitude")
                site_id = site.get("_id")

                site_latitude = float(site_latitude)
                site_longitude = float(site_longitude)

            except Exception as ex:
                print(ex)
                traceback.print_exc()
                continue

            site_meta_data = {
                "id": site_id,
            }

            print(f"Computing altitude for site {site_id} .....")
            altitude = model.get_altitude(site_latitude, site_longitude)
            print(f"Computing aspect for site {site_id} .....")
            aspect = model.get_aspect_270(site_latitude, site_longitude)
            print(f"Computing landform 90 for site {site_id} .....")
            landform_90 = model.get_landform90(site_latitude, site_longitude)
            print(f"Computing landform 270 for site {site_id} .....")
            landform_270 = model.get_landform270(site_latitude, site_longitude)
            print(f"Computing bearing from kampala for site {site_id} .....")
            bearing_from_kampala = model.get_bearing_from_kampala(
                site_latitude, site_longitude
            )
            print(f"Computing weather stations for site {site_id} .....")
            weather_stations = model.get_nearest_weather_stations(
                site_latitude, site_longitude
            )
            print(f"Saving site information for site {site_id} .....")
            validated_data = remove_invalidate_meta_data_values(
                {
                    "altitude": altitude,
                    "aspect": aspect,
                    "landform_90": landform_90,
                    "landform_270": landform_270,
                    "bearing_to_kampala_center": bearing_from_kampala,
                }
            )

            airqo_api.update_site_meta_data(
                {
                    **site_meta_data,
                    **validated_data,
                    **{"weather_stations": weather_stations},
                }
            )

            print(f"Computing distance from kampala for site {site_id} .....")
            distance_from_kampala = model.get_distance_from_kampala(
                site_latitude, site_longitude
            )
            print(f"Computing distance to closest road for site {site_id} .....")
            distance_to_closest_road = model.get_distance_to_closest_road(
                site_latitude, site_longitude
            )
            print(
                f"Computing distance to closest primary road for site {site_id} ....."
            )
            distance_to_closest_primary_road = (
                model.get_distance_to_closest_primary_road(
                    site_latitude, site_longitude
                )
            )
            print(
                f"Computing distance to closest secondary road for site {site_id} ....."
            )
            distance_to_closest_secondary_road = (
                model.get_distance_to_closest_secondary_road(
                    site_latitude, site_longitude
                )
            )
            print(
                f"Computing distance to closest residential road for site {site_id} ....."
            )
            distance_to_closest_residential_road = (
                model.get_distance_to_closest_residential_road(
                    site_latitude, site_longitude
                )
            )
            print(
                f"Computing distance to closest tertiary road for site {site_id} ....."
            )
            distance_to_closest_tertiary_road = (
                model.get_distance_to_closest_tertiary_road(
                    site_latitude, site_longitude
                )
            )
            print(f"Computing distance to closest trunk for site {site_id} .....")
            distance_to_closest_trunk = model.get_distance_to_closest_trunk(
                site_latitude, site_longitude
            )
            print(
                f"Computing distance to closest unclassified road for site {site_id} ....."
            )
            distance_to_closest_unclassified_road = (
                model.get_distance_to_closest_unclassified_road(
                    site_latitude, site_longitude
                )
            )
            print(f"Computing distance to closest motorway for site {site_id} .....")
            distance_to_closest_motorway = model.get_distance_to_closest_motorway(
                site_latitude, site_longitude
            )
            print(f"Computing greeness for site{site_id} s....")
            greenness_for_a_site = model.get_greenness(
                site_latitude, site_longitude
            )
            
            print(f"Saving distances for site {site_id} .....")
            validated_data = remove_invalidate_meta_data_values(
                {
                    "distance_to_kampala_center": distance_from_kampala,
                    "distance_to_nearest_road": distance_to_closest_road,
                    "distance_to_nearest_secondary_road": distance_to_closest_secondary_road,
                    "distance_to_nearest_primary_road": distance_to_closest_primary_road,
                    "distance_to_nearest_residential_road": distance_to_closest_residential_road,
                    "distance_to_nearest_tertiary_road": distance_to_closest_tertiary_road,
                    "distance_to_nearest_trunk": distance_to_closest_trunk,
                    "distance_to_nearest_unclassified_road": distance_to_closest_unclassified_road,
                    "distance_to_nearest_motorway": distance_to_closest_motorway,
                    "greenes_of_the_site":greenness_for_a_site,
                }
            )
            airqo_api.update_site_meta_data(
                {
                    **site_meta_data,
                    **validated_data,
                }
            )

            print(f"Computing land use for site {site_id} .....")
            land_use = model.get_landuse(site_latitude, site_longitude)
            print(f"Saving land use for site {site_id} .....")
            airqo_api.update_site_meta_data(
                {
                    **site_meta_data,
                    **{
                        "land_use": land_use,
                    },
                }
            )


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--target",
        required=True,
        type=str.lower,
        choices=[
            "air-qlouds-consumer",
            "sites-consumer",
            "devices-consumer",
        ],
    )

    args = parser.parse_args()
    if args.target == "air-qlouds-consumer":
        pass

    elif args.target == "sites-consumer":
        MessageBroker.listen_to_created_sites()

    elif args.target == "devices-consumer":
        pass
