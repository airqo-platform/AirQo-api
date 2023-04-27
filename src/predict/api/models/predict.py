import logging

from config.constants import connect_mongo

_logger = logging.getLogger(__name__)


def get_forecasts(site_id, db_name):
    """Retrieves forecasts from the database for the specified site_id."""
    db = connect_mongo()
    site_forecasts = list(db[db_name].find(
        {'site_id': site_id}, {'_id': 0}).sort([('$natural', -1)]).limit(1))

    results = []
    if len(site_forecasts) > 0:
        for i in range(0, len(site_forecasts[0]['pm2_5'])):
            time = site_forecasts[0]['time'][i]
            pm2_5 = site_forecasts[0]['pm2_5'][i]
            health_tips = site_forecasts[0]['health_tips']
            result = {'time': time, 'pm2_5': pm2_5, 'health_tips': health_tips}
            results.append(result)

    formatted_results = {'forecasts': results}
    return formatted_results
