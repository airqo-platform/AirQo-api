from collections import defaultdict

from .pm_25 import get_pollutant_category


def generate_pie_chart_data(records, key, pollutant):
    """
    Function to generate pie_chart data
    Args:
        records (list): list of pollutant objects (dict)
        key (str): a dict key to obtain the pollutant value from the record
        pollutant (str): string representing the pollutant

    Returns: a dict containing the category count
    """
    category_count = defaultdict(int)

    category_count.update({
        'Good': 0,
        'Moderate': 0,
        'UHFSG': 0,
        'Unhealthy': 0,
        'VeryUnhealthy': 0,
        'Hazardous': 0,
        'Other': 0,
    })

    for record in records:
        value = record[key]
        category = get_pollutant_category(value, pollutant=pollutant)
        category_count[category] = category_count[category] + 1

    return category_count
