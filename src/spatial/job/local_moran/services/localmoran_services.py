from flask import request, jsonify
from datetime import datetime
from geojson import FeatureCollection
from models.model import AirQualitySpatilaAnalyzer  

class SpatialDataHandler:
    @staticmethod
    def get_air_quality_data():
        try:
            post_data = request.get_json()

            if not all(key in post_data for key in ['grid_id', 'start_time', 'end_time']):
                return jsonify({'error': 'Missing required fields'}), 400

            grid_id = post_data.get('grid_id')
            start_time_str = post_data.get('start_time')
            end_time_str = post_data.get('end_time')

            if not isinstance(grid_id, str):
                return jsonify({'error': 'grid_id must be a string'}), 400

            try:
                start_time = datetime.fromisoformat(start_time_str)
                end_time = datetime.fromisoformat(end_time_str)
                if start_time == end_time:
                    return jsonify({'error':'Start time and end time cannot be the same.'}), 400
                if (end_time - start_time).days > 365:
                    return jsonify({'error':'Time range exceeded 12 months'}),400
            except ValueError:
                return jsonify({'error': 'Invalid datetime format for start_time or end_time. Required format: YYYY-MM-DDTHH:MM:SS'}), 400

            analyzer = AirQualitySpatilaAnalyzer()
            site_ids = analyzer.fetch_air_quality_data(grid_id, start_time, end_time)

            if not site_ids:
                return jsonify({'error': 'No air quality data available for the specified parameters.'}), 404

            results = analyzer.query_bigquery(site_ids, start_time, end_time)

            if results is None:
                return jsonify({'error': 'Error querying BigQuery for air quality data.'}), 500

            df = analyzer.results_to_dataframe(results)
            gdf = analyzer.get_data_for_moran(df)
            moran_result = analyzer.moran_local(analyzer.moran_local_regression(gdf), gdf)
            moran_result_list = moran_result.tolist()
            moran_result_num = analyzer.moran_num_local(analyzer.moran_local_regression(gdf), gdf)
            moran_result_num = moran_result_num.tolist()
            local_moran_statistics = analyzer.moran_statistics(gdf)

            gdf_geojson = FeatureCollection([
                {
                    'latitude': xy[1],
                    'longitude': xy[0],
                    'PM2_5_calibrated_Value': val,
                    'moran_result_num': moran_num,
                    'local_cluster_category': cluster
                }
                for xy, val, cluster, moran_num in zip(gdf.geometry.apply(lambda geom: (geom.x, geom.y)), gdf['calibratedValue'], moran_result_list, moran_result_num)
            ])

            response_data = {
                'LocalMoranReport': {
                    'status': 'success',
                    'local_moran_weight_method': 'Queen Contiguity Method',
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
                    }
                }
            }

            return jsonify(response_data), 200

        except Exception as e:
            return jsonify({'error': f'An error occurred: Please try again '}), 500
