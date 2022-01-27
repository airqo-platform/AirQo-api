from collections import defaultdict

from .pm_25 import get_pollutant_category, PM_COLOR_CATEGORY


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


def _destructure_pie_data(generated_data):
    result = []
    for data in generated_data:
        destructured = []
        name = data.pop('name')
        for key in data.keys():
            destructured.append({
                'name': name,
                'category': key,
                'color': PM_COLOR_CATEGORY.get(key, '#808080'),
                'value': data[key],
            })
        result.append(destructured)

    return result


def d3_generate_pie_chart_data(records, pollutant):
    """
    Function to generate pie_chart data
    Args:
        records (list): list of pollutant objects (dict)
        key (str): a dict key to obtain the pollutant value from the record
        pollutant (str): string representing the pollutant

    Returns: a dict containing the category count
    """

    def default_value():
        return {
            'Good': 0,
            'Moderate': 0,
            'UHFSG': 0,
            'Unhealthy': 0,
            'VeryUnhealthy': 0,
            'Hazardous': 0,
            'Other': 0,
            'Unknown': 0,
        }

    location_category_count = defaultdict(default_value)

    for record in records:
        value = record.get('value')
        name = record.get('name') or record.get('generated_name')
        category = get_pollutant_category(value, pollutant=pollutant)
        location_category_count[name][category] = location_category_count[name][category] + 1
        location_category_count[name][category] = location_category_count[name][category] + 1
        location_category_count[name]['name'] = name

    print(len(location_category_count.values()))
    return _destructure_pie_data(location_category_count.values())
