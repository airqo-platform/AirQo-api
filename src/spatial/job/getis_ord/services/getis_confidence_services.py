from flask import request, jsonify
from datetime import datetime
from geojson import FeatureCollection
from model.model import AirQualitySpatialAnalyzer 

class SpatialDataHandler_confidence:
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
                    return jsonify({'error':'Time range exceeded 12 months'}), 400
            except ValueError:
                return jsonify({'error': 'Invalid datetime format for start_time or end_time. Required format: YYYY-MM-DDTHH:MM:SS'}), 400

            analyzer = AirQualitySpatialAnalyzer() 
            site_ids = analyzer.fetch_air_quality_data(grid_id, start_time, end_time)

            if not site_ids:
                return jsonify({'error': 'No air quality data available for the specified id.'}), 404

            results = analyzer.query_bigquery(site_ids, start_time, end_time)

            if results is None:
                return jsonify({'error': 'Error querying BigQuery for air quality data.'}), 500

            df = analyzer.results_to_dataframe(results)
            gdf = analyzer.get_data_for_getis(df)
            
            getis_results = analyzer.Getis_ord_GI_confidence(gdf)
            (significant_hot_spots_99,significant_hot_spots_95,
            significant_hot_spots_90, significant_cold_spots_99,
            significant_cold_spots_95,significant_cold_spots_90,not_significant)= getis_results
            
            significant_hot_spots_99_df = gdf[significant_hot_spots_99]
            significant_hot_spots_95_df = gdf[significant_hot_spots_95]
            significant_hot_spots_90_df = gdf[significant_hot_spots_90]
            significant_cold_spots_99_df = gdf[significant_cold_spots_99]
            significant_cold_spots_95_df = gdf[significant_cold_spots_95]
            significant_cold_spots_90_df = gdf[significant_cold_spots_90]

            not_significant_df = gdf[not_significant]
                      
            def convert_dataframe_to_geojson(df):
                geojson_features = []
                for feature in df.iterfeatures():
                        properties = feature['properties']
                        geometry = feature['geometry']
                        properties['longitude'] = properties.pop('longitude')
                        properties['latitude'] = properties.pop('latitude')
                        properties['PM2_5_Value'] = properties.pop('PM2_5_Value')
                        feature['geometry'] = geometry
                        feature['properties'] = properties
                        geojson_features.append(feature)
                return FeatureCollection(geojson_features)
            significant_hot_spots_99_geojson = convert_dataframe_to_geojson(significant_hot_spots_99_df)
            significant_hot_spots_95_geojson = convert_dataframe_to_geojson(significant_hot_spots_95_df)
            significant_hot_spots_90_geojson = convert_dataframe_to_geojson(significant_hot_spots_90_df)
            significant_cold_spots_99_geojson = convert_dataframe_to_geojson(significant_cold_spots_99_df)
            significant_cold_spots_95_geojson = convert_dataframe_to_geojson(significant_cold_spots_95_df)
            significant_cold_spots_90_geojson = convert_dataframe_to_geojson(significant_cold_spots_90_df)
            not_significant_df_geojson = convert_dataframe_to_geojson(not_significant_df)

            response_data = {
                'getis_Report': {
                    'status': 'success',
                    'grid_summary': {                        
                        'grid_id': grid_id,
                        'site_ids': site_ids,
                        'number_of_sites': len(site_ids)
                    },
                    'period': {
                        'startTime': start_time.isoformat(),
                        'endTime': end_time.isoformat(),
                    },
                    'getis_statistics': {
                            'significant_hot_spots_99': significant_hot_spots_99_geojson,
                            'significant_hot_spots_95': significant_hot_spots_95_geojson,
                            'significant_hot_spots_90':  significant_hot_spots_90_geojson,   
                            'significant_cold_spots_99':  significant_cold_spots_99_geojson, 
                            'significant_cold_spots_95':  significant_cold_spots_95_geojson,  
                            'significant_cold_spots_90':  significant_cold_spots_90_geojson,    
                            'not_significant': not_significant_df_geojson                 
                    }
                }
            }
            return jsonify(response_data), 200

        except Exception as e:
            return jsonify({'error': f'An error occurred: '}), 500  
