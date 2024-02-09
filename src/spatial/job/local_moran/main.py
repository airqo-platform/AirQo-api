from flask import Flask, jsonify, request
from utils import (fetch_air_quality_data, query_bigquery,
                    results_to_dataframe, get_data_for_moran,
                    moran_local_regression, moran_local, moran_num_local
                    )
from geojson import FeatureCollection, Point, Feature
from datetime import datetime

app = Flask(__name__)

@app.route('/spatial', methods=['POST'])
def get_air_quality_data():
    try:
        # Parse input data from Postman
        post_data = request.get_json()
        grid_id = post_data.get('grid_id')
        start_time_str = post_data.get('start_time')
        end_time_str = post_data.get('end_time')

        # Convert start_time and end_time to datetime objects
        start_time = datetime.fromisoformat(start_time_str)
        end_time = datetime.fromisoformat(end_time_str)

        # Fetch site_ids using the provided grid_id and time range
        site_ids = fetch_air_quality_data(grid_id, start_time, end_time)

        if not site_ids:
            response_data = {
                'airquality': {
                    'status': 'error',
                    'message': 'No air quality data available for the specified parameters.'
                }
            }
            return jsonify(response_data)

        # Query BigQuery for air quality data based on site_ids and time range
        results = query_bigquery(site_ids, start_time, end_time)

        if results is None:
            response_data = {
                'airquality': {
                    'status': 'error',
                    'message': 'Error querying BigQuery for air quality data.'
                }
            }
            return jsonify(response_data)

        # Convert results to DataFrame and perform necessary data manipulations
        df = results_to_dataframe(results)

        # Get GeoDataFrame for Local Moran's I analysis
        gdf = get_data_for_moran(df)

        # Perform Local Moran's I analysis
        moran_result = moran_local(moran_local_regression(gdf), gdf)
        moran_result_list = moran_result.tolist()

        moran_result_num = moran_num_local(moran_local_regression(gdf), gdf)
        moran_result_num = moran_result_num.tolist()

        # Create GeoJSON with "cluster" attribute
        gdf_geojson = FeatureCollection([
            {
                'latitude': xy[1],  # Extract latitude from coordinates
                'longitude': xy[0],  # Extract longitude from coordinates
                'PM2_5_calibrated_Value': val,  # Replace with your function for LOCAL moran
                'moran_result_num': moran_num,
                'cluster': cluster
            }
            for xy, val, cluster, moran_num in zip(gdf.geometry.apply(lambda geom: (geom.x, geom.y)), gdf['calibratedValue'], moran_result_list, moran_result_num)
            ])

        # Construct the final response data
        response_data = {
            'airquality': {
                'status': 'success',
                'grid_id': grid_id,
                'sites':{
                    'site_ids': site_ids,
                    'number_of_sites': len(site_ids)
                        },                
                'period': {
                    'startTime': start_time.isoformat(),
                    'endTime': end_time.isoformat(),
                },
                'moran_data': {
                    'moran': gdf_geojson,
        #            'moran_local_category': moran_result_list,
        #            'moran_local_num': moran_result_num,
                }
            }
        }

        return jsonify(response_data)

    except Exception as e:
        response_data = {
            'airquality': {
                'status': 'error',
                'message': f'An error occurred: {str(e)}'
            }
        }
        return jsonify(response_data)

if __name__ == '__main__':
    app.run()