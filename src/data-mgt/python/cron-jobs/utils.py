import math


def to_double(x):
    try:
        value = float(x)
        if math.isnan(value):
            return None
        return value
    except:
        return None
