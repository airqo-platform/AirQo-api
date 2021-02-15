PM_25_COLOR_MAPPER = {
    500.4: '#808080',
    250.4: '#81202e',
    150.4: '#8639c0',
    55.4: '#fe0000',
    35.4: '#ee8310',
    12: '#f8fe28',
    0: '#45e50d',

}


def set_pm25_category_background(pm25_value):
    keys = sorted(PM_25_COLOR_MAPPER.keys(), reverse=True)

    for key in keys:
        if pm25_value > key:
            return PM_25_COLOR_MAPPER[key]
