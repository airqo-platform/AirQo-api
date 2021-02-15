PM_25_COLOR_MAPPER = {
    500.4: '#808080',
    250.4: '#81202e',
    150.4: '#8639c0',
    55.4: '#fe0000',
    35.4: '#ee8310',
    12: '#f8fe28',
    0: '#45e50d',

}

PM_25_CATEGORY = {
    'Good': [0, 12],
    'Moderate': [12, 35.4],
    'UHFSG': [35.4, 55.4],
    'Unhealthy': [55.4, 150.4],
    'VeryUnhealthy': [150.4, 250.4],
    'Hazardous': [250.4, 500.4],
    'All': [0, 2000],
}


def set_pm25_category_background(pm25_value):
    keys = sorted(PM_25_COLOR_MAPPER.keys(), reverse=True)

    for key in keys:
        if pm25_value > key:
            return PM_25_COLOR_MAPPER[key]


def categorise_pm25_values(records, category):
    categorised = []

    if category == 'All':
        return records

    try:
        min_value, max_value = PM_25_CATEGORY.get(category, [])
    except ValueError:
        return []

    for record in records:
        if min_value < record['Last_Hour_PM25_Value'] <= max_value:
            categorised.append(record)

    return categorised


