import numpy as np
import scipy.stats


# Generates possible configurations based on nominated number of cycles eg 24 or 168
# loop through number of hours in the dataframe
def simple_configs(df):
    configs = list()
    hours = 24
    for i in range(1, int((len(df)) / 24)):
        cfg = [i, hours]
        configs.append(cfg)
    return configs


def mean_confidence_interval(data, confidence=0.95):
    """
        calculating mean and confidence intervals
    """
    a = 1.0 * np.array(data)
    n = len(a)
    m, se = np.mean(a), scipy.stats.sem(a, nan_policy='omit')
    h = se * scipy.stats.t.ppf((1 + confidence) / 2., n - 1)
    mean = m
    lower_ci = m - h
    upper_ci = m + h
    return mean, lower_ci, upper_ci
