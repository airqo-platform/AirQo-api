import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_samples, silhouette_score
from pandas.io.json import json_normalize
import json
from flask import jsonify
from shapely.geometry import shape, Point
import sys
from collections.abc import MutableMapping
from models.parishes import Parish
from models.administrative_level import AdminLevel

# locate_parish = Parish()


def json_to_df(json_list):
    """
    converts json records to normalized dataframe
    """
    return json_normalize(json_list)


def process_data(data):
    """
    preprocesses geocensus data
    """

    data.dropna(axis=0, inplace=True)
    data = data.reset_index(drop=True)
    return data


def silhouette(X):
    """
    determines the optimal number of clusters using silhouette score
    """
    silhouette_avgs = {}
    n_clusters = [x for x in range(2, X.shape[0] - 1)]
    for n in n_clusters:
        clusterer = KMeans(n_clusters=n, random_state=10)
        cluster_labels = clusterer.fit_predict(X)
        silhouette_avg = silhouette_score(X, cluster_labels)
        silhouette_avgs[n] = silhouette_avg
    key_max = max(silhouette_avgs.keys(), key=(lambda k: silhouette_avgs[k]))
    return key_max


def scaling(data):
    """
    Normalizes data
    """
    scaled_data = StandardScaler().fit_transform(data)
    return scaled_data


def kmeans_algorithm(data, sensor_number=None):
    """
    Clustering data using K-Means Model
    """
    if sensor_number == None:
        sensor_number = silhouette(data)

    X = data[
        [
            "properties.lat",
            "properties.long",
            "properties.population_density",
            "properties.household_density",
            "properties.charcoal_per_km2",
            "properties.firewood_per_km2",
            "properties.grass_per_km2",
            "properties.wasteburning_per_km2",
            "properties.kitch_outsidebuilt_per_km2",
            "properties.kitch_makeshift_per_km2",
            "properties.kitch_openspace_per_km2",
        ]
    ]

    X_scaled = scaling(X)

    kmeans = KMeans(n_clusters=sensor_number).fit(X_scaled)
    y_kmeans = kmeans.fit_predict(X_scaled)

    data_copy = data.copy()

    data_copy["cluster"] = y_kmeans

    kmeans_samples = data_copy.sample(frac=1).reset_index(drop=True)
    kmeans_samples = kmeans_samples.drop_duplicates("cluster", keep="last")
    kmeans_samples = kmeans_samples[
        [
            "properties.district",
            "properties.subcounty",
            "properties.parish",
            "properties.lat",
            "properties.long",
            "geometry.coordinates",
        ]
    ]
    return json.loads(kmeans_samples.to_json(orient="records"))


def kmeans_algorithm_v2(data, sensor_number=None):
    """
    Clustering data using K-Means Model
    """
    print(data.columns)
    if sensor_number == None:
        sensor_number = silhouette(data)

    X = data[
        [
            "properties.elevation",
            "properties.greenness",
            "properties.population_density",
            #   'properties.name_1', 'properties.name_2', 'properties.name_3','properties.name_4'
        ]
    ]

    X_scaled = scaling(X)

    kmeans = KMeans(n_clusters=sensor_number).fit(X_scaled)
    y_kmeans = kmeans.fit_predict(X_scaled)

    data_copy = data.copy()

    data_copy["cluster"] = y_kmeans

    kmeans_samples_ = data_copy.sample(frac=1).reset_index(drop=True)
    kmeans_samples_ = kmeans_samples_.drop_duplicates("cluster", keep="last")
    included_columns = [
        "properties.name_1",
        "properties.name_2",
        "properties.name_3",
        "properties.name_4",
        "properties.admin_levels_metadata.admin_level_1",
        "properties.admin_levels_metadata.admin_level_2",
        "properties.admin_levels_metadata.admin_level_3",
        "properties.admin_levels_metadata.admin_level_4",
        "geometry.coordinates",
    ]

    # Create a new DataFrame with included columns
    kmeans_samples = pd.DataFrame()

    for column in included_columns:
        if column in kmeans_samples_.columns:
            kmeans_samples[column] = kmeans_samples_[column]

    """
    kmeans_samples = kmeans_samples[
        [
            "properties.name_1",
            "properties.name_2",
            "properties.name_3",
            "properties.name_4",
            "properties.admin_levels_metadata.admin_level_1",
            "properties.admin_levels_metadata.admin_level_2",
            "properties.admin_levels_metadata.admin_level_3",
            "properties.admin_levels_metadata.admin_level_4",
            "geometry.coordinates",
        ]
    ]
    """
    return json.loads(kmeans_samples.to_json(orient="records"))


def get_data(data):
    """
     This function deserializes an JSON object.
    :param data: JSON data
     :type data: str
    """
    json_data = json.loads(data)
    print("Deserialized data: {}".format(data))
    return json_data


def point_exists_in_polygon(point, polygon):
    """
    checks whether a given point exists in a defined polygon
    """

    geo_point = Point(point[0], point[1])
    geo_polygon = {"coordinates": polygon, "type": "Polygon"}
    geo_polygon = shape(geo_polygon)
    if geo_polygon.contains(geo_point):
        return True
    else:
        return False


def delete_keys_from_dict(dictionary, keys):
    """
    deletes certain keys and their values from a dictionary
    """
    keys_set = set(keys)
    modified_dict = {}
    for key, value in dictionary.items():
        if key not in keys_set:
            if isinstance(value, MutableMapping):
                modified_dict[key] = delete_keys_from_dict(value, keys_set)
            else:
                modified_dict[key] = value
    return modified_dict


def recommend_locations(sensor_number, must_have_coordinates, polygon, tenant):
    """
    recommends parishes in which to place sensors
    """
    locate_parish = Parish(tenant)
    if polygon == None:
        return jsonify({"response": "Please draw a polygon"}), 200
    elif must_have_coordinates == None:
        all_parishes = locate_parish.get_parishes_map(polygon)
        print("All Parishes", file=sys.stderr)
        print(len(all_parishes), file=sys.stderr)
        if all_parishes == "Invalid polygon" or len(all_parishes) < 2:
            return jsonify({"response": "Invalid polygon"}), 200
        else:
            all_parishes_df = json_to_df(all_parishes)
            all_parishes_df = process_data(all_parishes_df)
            recommended_parishes = kmeans_algorithm(all_parishes_df, sensor_number)
            for parish in recommended_parishes:
                parish["color"] = "blue"
                parish["type"] = "RECOMMENDED"
                parish["fill_color"] = "blue"
            return jsonify(recommended_parishes)
    else:
        all_parishes = locate_parish.get_parishes_map(polygon)
        count = 0  # number of coordinates that don't exist in polygon and aren't in database
        known_must_have_parishes = []  # coordinates that in the polygon and database
        unknown_must_have_parishes = (
            []
        )  # for coordinates that are in database but aren't in polygondon't belong to any parish in the database

        for coordinates in must_have_coordinates:
            exists = point_exists_in_polygon(coordinates, polygon)
            parish = locate_parish.get_parish_for_point(coordinates)
            if parish and exists:
                known_must_have_parishes.append(parish[0])
            elif parish:
                unknown_must_have_parishes.append(parish[0])
            else:
                count += 1
        must_have_parishes = known_must_have_parishes + unknown_must_have_parishes
        difference_parishes = [
            parish for parish in all_parishes if parish not in must_have_parishes
        ]
        difference_parishes_df = json_to_df(difference_parishes)
        difference_parishes_df = process_data(difference_parishes_df)
        new_sensor_number = sensor_number - len(must_have_parishes)
        try:
            recommended_parishes = kmeans_algorithm(
                difference_parishes_df, new_sensor_number
            )

            keys_to_delete = [
                "type_4",
                "elevation",
                "greenness",
                "population_density",
            ]

            for parish in recommended_parishes:
                parish["color"] = "blue"
                parish["fill_color"] = "blue"
                parish["type"] = "RECOMMENDED"
            for i in range(len(known_must_have_parishes)):
                known_must_have_parishes[i]["color"] = "orange"
                known_must_have_parishes[i]["fill_color"] = "orange"
                known_must_have_parishes[i] = delete_keys_from_dict(
                    known_must_have_parishes[i], keys_to_delete
                )
                known_must_have_parishes[i]["type"] = "INSIDE POLYGON"
            for i in range(len(unknown_must_have_parishes)):
                unknown_must_have_parishes[i]["color"] = "red"
                unknown_must_have_parishes[i]["fill_color"] = "red"
                unknown_must_have_parishes[i] = delete_keys_from_dict(
                    unknown_must_have_parishes[i], keys_to_delete
                )
                unknown_must_have_parishes[i]["type"] = "OUTSIDE POLYGON"

            final_parishes = (
                recommended_parishes
                + known_must_have_parishes
                + unknown_must_have_parishes
            )
            return jsonify(final_parishes)
        except:
            return {
                "message": "An exception occured due to invalid input. Please try again"
            }, 200


def recommend_locations_for_sensor_placement(
    sensor_number, must_have_coordinates, polygon, tenant
):
    """
    recommends administrative level (location) in which to place sensors
    """

    admin_level_instance = AdminLevel(tenant)
    if polygon == None:
        return jsonify({"response": "Please draw a polygon"}), 200
    elif must_have_coordinates == None:
        all_admin_levels = admin_level_instance.get_administrative_level_map(polygon)
        print("All Admin Levels")
        print(len(all_admin_levels))
        if all_admin_levels == "Invalid polygon" or len(all_admin_levels) < 2:
            return jsonify({"response": "Invalid polygon"}), 200
        else:
            all_admin_levels_df = json_to_df(all_admin_levels)
            all_admin_levels_df = process_data(all_admin_levels_df)  # drop nans
            recommended_admin_levels = kmeans_algorithm_v2(
                all_admin_levels_df, sensor_number
            )
            for admin_level in recommended_admin_levels:
                admin_level["color"] = "blue"
                admin_level["type"] = "RECOMMENDED"
                admin_level["fill_color"] = "blue"
            return jsonify(recommended_admin_levels)
    else:
        all_admin_levels = admin_level_instance.get_administrative_level_map(polygon)
        count = 0  # number of coordinates that don't exist in polygon and aren't in database
        known_must_have_admin_levels = (
            []
        )  # coordinates that in the polygon and database
        unknown_must_have_admin_levels = (
            []
        )  # for coordinates that are in database but aren't in polygondon't belong to any parish in the database

        for coordinates in must_have_coordinates:
            exists = point_exists_in_polygon(coordinates, polygon)
            admin_level_region = (
                admin_level_instance.get_administrative_region_for_point(coordinates)
            )
            if admin_level_region and exists:
                known_must_have_admin_levels.append(admin_level_region[0])
            elif admin_level_region:
                unknown_must_have_admin_levels.append(admin_level_region[0])
            else:
                count += 1
        must_have_admin_levels = (
            known_must_have_admin_levels + unknown_must_have_admin_levels
        )
        difference_admin_levels = [
            admin_level
            for admin_level in all_admin_levels
            if admin_level not in must_have_admin_levels
        ]
        difference_admin_levels_df = json_to_df(difference_admin_levels)
        difference_admin_levels_df = process_data(difference_admin_levels_df)
        new_sensor_number = sensor_number - len(must_have_admin_levels)
        try:
            recommended_admin_levels = kmeans_algorithm_v2(
                difference_admin_levels_df, new_sensor_number
            )

            keys_to_delete = [
                "type_4",
                "elevation",
                "greenness",
                "population_density",
            ]

            for admin_level in recommended_admin_levels:
                admin_level["color"] = "blue"
                admin_level["fill_color"] = "blue"
                admin_level["type"] = "RECOMMENDED"
            for i in range(len(known_must_have_admin_levels)):
                known_must_have_admin_levels[i]["color"] = "orange"
                known_must_have_admin_levels[i]["fill_color"] = "orange"
                known_must_have_admin_levels[i] = delete_keys_from_dict(
                    known_must_have_admin_levels[i], keys_to_delete
                )
                known_must_have_admin_levels[i]["type"] = "INSIDE POLYGON"
            for i in range(len(unknown_must_have_admin_levels)):
                unknown_must_have_admin_levels[i]["color"] = "red"
                unknown_must_have_admin_levels[i]["fill_color"] = "red"
                unknown_must_have_admin_levels[i] = delete_keys_from_dict(
                    unknown_must_have_admin_levels[i], keys_to_delete
                )
                unknown_must_have_admin_levels[i]["type"] = "OUTSIDE POLYGON"

            final_admin_levels = (
                recommended_admin_levels
                + known_must_have_admin_levels
                + unknown_must_have_admin_levels
            )
            return jsonify(final_admin_levels)
        except:
            return {
                "message": "An exception occured due to invalid input. Please try again"
            }, 200
