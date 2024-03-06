from flask import Flask, request, jsonify
from datetime import datetime
import logging
from api.utils.pollutants.report import (
    fetch_air_quality_data, query_bigquery,
    results_to_dataframe, PManalysis)
# Configure logging
logging.basicConfig(filename="report_log.log", level=logging.INFO, filemode="w")

def air_quality_data():
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
        logging.error("Invalid date format: %s", e)
        return jsonify({"error": "Invalid date format"}), 400

    site_ids = fetch_air_quality_data(grid_id, start_time, end_time)

    if site_ids:
        results = query_bigquery(site_ids, start_time, end_time)
        if results is not None:
            processed_data = results_to_dataframe(results)
            daily_mean_pm2_5 = PManalysis.mean_daily_pm2_5(processed_data)
            datetime_mean_pm2_5 = PManalysis.datetime_pm2_5(processed_data)
            site_mean_pm2_5 = PManalysis.mean_pm2_5_by_site_name(processed_data)
            hour_mean_pm2_5 = PManalysis.mean_pm2_5_by_hour(processed_data)
            pm2_5_by_month = PManalysis.mean_pm2_5_by_month(processed_data)
            pm2_5_by_month_name = PManalysis.mean_pm2_5_by_month_name(processed_data)
            pm2_5_by_month_year = PManalysis.mean_pm2_5_by_month_year(processed_data)
            monthly_mean_pm_by_site_name =  PManalysis.monthly_mean_pm_site_name(processed_data)
            mean_pm2_5_year = PManalysis.mean_pm2_5_by_year(processed_data)
            mean_pm_by_city= PManalysis.pm_by_city(processed_data)
            mean_pm_by_country = PManalysis.pm_by_country(processed_data)
            mean_pm_by_region= PManalysis.pm_by_region(processed_data)
            mean_pm_by_day_of_week= PManalysis.pm_day_name(processed_data)
            mean_pm_by_day_hour = PManalysis.pm_day_hour_name(processed_data)
            mean_pm_by_site_year = PManalysis.annual_mean_pm_site_name(processed_data)
            grid_name = PManalysis.gridname(processed_data)
            # Convert timestamps to the desired format
            daily_mean_pm2_5["date"] = daily_mean_pm2_5["date"].dt.strftime("%Y-%m-%d")
            datetime_mean_pm2_5["timestamp"] = datetime_mean_pm2_5[
                "timestamp"
            ].dt.strftime("%Y-%m-%d %H:%M %Z")
            #            daily_mean_pm_dict = daily_mean_pm2_5.to_dict(orient='records')
            # Log some information for debugging or monitoring
            logging.info(
                "Successfully processed air quality data for grid_id %s", grid_id
            )
            # Prepare the response data in a structured format
            response_data = {
                "airquality": {
                    "status": "success",
                    "grid_id": grid_id,
                    "sites": {"site_ids": site_ids, 
                              "number_of_sites": len(site_ids),
                              "grid name": grid_name,},
                              
                    "period": {
                        "startTime": start_time.isoformat(),
                        "endTime": end_time.isoformat(),
                    },

                    'daily_mean_pm': daily_mean_pm2_5.to_dict(orient='records'),
                    'datetime_mean_pm': datetime_mean_pm2_5.to_dict(orient='records'),
                    'diurnal': hour_mean_pm2_5.to_dict(orient='records'),
                    'annual_pm': mean_pm2_5_year.to_dict(orient='records'),
                    'monthly_pm': pm2_5_by_month.to_dict(orient='records'),
                    'pm_by_month_year': pm2_5_by_month_year.to_dict(orient='records'),
                    'pm_by_month_name': pm2_5_by_month_name.to_dict(orient='records'),
                    'site_monthly_mean_pm': monthly_mean_pm_by_site_name.to_dict(orient='records'),
                    'site_annual_mean_pm':mean_pm_by_site_year.to_dict(orient='records'),                    
                    'site_mean_pm': site_mean_pm2_5.to_dict(orient='records'),
                    'mean_pm_by_city': mean_pm_by_city.to_dict(orient='records'),   
                    'mean_pm_by_country': mean_pm_by_country.to_dict(orient='records'),
                    'mean_pm_by_region': mean_pm_by_region.to_dict(orient='records'),
                    'mean_pm_by_day_of_week': mean_pm_by_day_of_week.to_dict(orient='records'),
                    'mean_pm_by_day_hour': mean_pm_by_day_hour.to_dict(orient='records'),                    

                }
            }
            return jsonify(response_data)
        else:
            return (
                jsonify({"message": "No data available for the given time frame."}),
                404,
            )
    else:
        return jsonify({"message": "No site IDs found for the given parameters."}), 404
