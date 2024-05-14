from flask import request, jsonify
from datetime import datetime
import logging
import numpy as np
from utils.pollutants.report import (fetch_air_quality_data, query_bigquery,
                                     results_to_dataframe, PManalysis)

# Configure logging
logging.basicConfig(filename='report_log.log', level=logging.INFO, filemode='w')

def air_quality_data_diurnal():
    data = request.get_json()
    grid_id = data.get("grid_id", "")
    start_time_str = data.get("start_time", "")
    end_time_str = data.get("end_time", "")

    try:
        start_time = datetime.fromisoformat(start_time_str)
        end_time = datetime.fromisoformat(end_time_str)
        if start_time == end_time:
            return jsonify({'error':'Start time and end time cannot be the same.'}), 400
        
        if (end_time - start_time).days > 365:
            return jsonify({'error':'Time range exceeded 12 months'}),400
    except ValueError as e:
        logging.error('Invalid date format: %s', e)
        return jsonify({'error': 'Invalid date format'}), 400

    site_ids = fetch_air_quality_data(grid_id, start_time, end_time)

    if site_ids:
        results = query_bigquery(site_ids, start_time, end_time)
        if results is not None:
            processed_data = results_to_dataframe(results)
            daily_mean_pm2_5 = PManalysis.mean_daily_pm2_5(processed_data)
            datetime_mean_pm2_5 = PManalysis.datetime_pm2_5(processed_data)
            hour_mean_pm2_5 = PManalysis.mean_pm2_5_by_hour(processed_data)
            mean_pm_by_day_hour =PManalysis.pm_day_hour_name(processed_data)
            grid_name = PManalysis.gridname(processed_data)

            # Convert timestamps to the desired format
            daily_mean_pm2_5['date'] = daily_mean_pm2_5['date'].dt.strftime('%Y-%m-%d')
            datetime_mean_pm2_5['timestamp'] = datetime_mean_pm2_5['timestamp'].dt.strftime('%Y-%m-%d %H:%M %Z')
#            daily_mean_pm_dict = daily_mean_pm2_5.to_dict(orient='records')
            # Log some information for debugging or monitoring
            logging.info('Successfully processed air quality data for grid_id %s', grid_id)
            # Prepare the response data in a structured format
            response_data = {
                'airquality': {
                    'status': 'success',
                    'grid_id': grid_id,
                    'sites': {
                        'site_ids': site_ids,
                        'number_of_sites': len(site_ids),
                        "grid name": grid_name
                    },
                    'period': {
                        'startTime': start_time.isoformat(),
                        'endTime': end_time.isoformat(),
                    },
                    'diurnal': hour_mean_pm2_5.to_dict(orient='records'),
                    'mean_pm_by_day_hour':mean_pm_by_day_hour.to_dict(orient='records'),
                    
                }
            }
            def replace_nan_with_null(obj):
                if isinstance(obj, list):
                    return [replace_nan_with_null(item) for item in obj]
                elif isinstance(obj, dict):
                    return {key: replace_nan_with_null(value) for key, value in obj.items()}
                elif isinstance(obj, float) and np.isnan(obj):
                    return None
                else:
                    return obj
            response_data = replace_nan_with_null(response_data)
            return jsonify(response_data)
        else:
            return jsonify({"message": "No data available for the given time frame."}), 404
    else:
        return jsonify({"message": "No site IDs found for the given parameters."}), 404
