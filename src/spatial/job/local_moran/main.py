from flask import Flask, jsonify, request
from utils import AirQualitySpatilaAnalyzer
from geojson import FeatureCollection
from datetime import datetime

app = Flask(__name__)

@app.route('/spatial', methods=['POST'])
def get_air_quality_data():
    try:
        # Parse input data from Postman
        post_data = request.get_json()

        # Input Validation
        if not all(key in post_data for key in ['grid_id', 'start_time', 'end_time']):
            return jsonify({'error': 'Missing required fields'}), 400

        grid_id = post_data.get('grid_id')
        start_time_str = post_data.get('start_time')
        end_time_str = post_data.get('end_time')

        # Type Checking and Validation
        if not isinstance(grid_id, str):
            return jsonify({'error': 'grid_id must be a string'}), 400

        try:
            start_time = datetime.fromisoformat(start_time_str)
            end_time = datetime.fromisoformat(end_time_str)
        except ValueError:
            return jsonify({'error': 'Invalid datetime format for start_time or end_time. Required format: YYYY-MM-DDTHH:MM:SS'}), 400

        # Initialize AirQualitySpatilaAnalyzer
        analyzer = AirQualitySpatilaAnalyzer()

        # Fetch site_ids using the provided grid_id and time range
        site_ids = analyzer.fetch_air_quality_data(grid_id, start_time, end_time)

        if not site_ids:
            return jsonify({'error': 'No air quality data available for the specified parameters.'}), 404

        # Query BigQuery for air quality data based on site_ids and time range
        results = analyzer.query_bigquery(site_ids, start_time, end_time)

        if results is None:
            return jsonify({'error': 'Error querying BigQuery for air quality data.'}), 500

        # Convert results to DataFrame and perform necessary data manipulations
        df = analyzer.results_to_dataframe(results)

        # Get GeoDataFrame for Local Moran's I analysis
        gdf = analyzer.get_data_for_moran(df)

        # Perform Local Moran's I analysis
        moran_result = analyzer.moran_local(analyzer.moran_local_regression(gdf), gdf)
        moran_result_list = moran_result.tolist()

        moran_result_num = analyzer.moran_num_local(analyzer.moran_local_regression(gdf), gdf)
        moran_result_num = moran_result_num.tolist()

        local_moran_statistics = analyzer.moran_statistics(gdf)

        # Create GeoJSON with "cluster" attribute
        gdf_geojson = FeatureCollection([
            {
                'latitude': xy[1],  # Extract latitude from coordinates
                'longitude': xy[0],  # Extract longitude from coordinates
                'PM2_5_calibrated_Value': val,  # Replace with your function for LOCAL moran
                'moran_result_num': moran_num,
                'local_cluster_category': cluster
            }
            for xy, val, cluster, moran_num in zip(gdf.geometry.apply(lambda geom: (geom.x, geom.y)), gdf['calibratedValue'], moran_result_list, moran_result_num)
        ])

        # Construct the final response data
        response_data = {
            'airquality': {
                'status': 'success',
                'grid_id': grid_id,
                'sites': {
                    'site_ids': site_ids,
                    'number_of_sites': len(site_ids)
                },
                'period': {
                    'startTime': start_time.isoformat(),
                    'endTime': end_time.isoformat(),
                },
                'moran_data': {
                    'moran': gdf_geojson,
                    'moran_statistics': local_moran_statistics.to_dict(),
                    # 'moran_local_category': moran_result_list,
                    # 'moran_local_num': moran_result_num,
                }
            }
        }

        return jsonify(response_data), 200

    except Exception as e:
        return jsonify({'error': f'An error occurred: Please try again '}), 500

if __name__ == '__main__':
    app.run()
