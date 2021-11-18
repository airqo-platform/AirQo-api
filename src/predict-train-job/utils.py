from datetime import date, datetime
from dateutil.relativedelta import relativedelta


def previous_months_range(n):
    """
    Function that calculates the previous months date ranges
    Args:
        n (int): represents the number of previous months range e.g 3 for three months ago
    """
    # end_date = date.today()
    end_date = datetime.now()
    start_date = end_date + relativedelta(months=-n)

    return start_date, end_date


def str_to_date(st):
    """
    Converts a string to datetime
    """
    return datetime.strptime(st, '%Y-%m-%dT%H:%M:%S.%fZ')


def date_to_str(date):
    """
    Converts datetime to a string
    """
    return datetime.strftime(date, '%Y-%m-%dT%H:%M:%S.%fZ')


def checkKey(dict, key):
        '''
        checks wether specified key is available in the specified dictionary.
        ''' 
        if key in dict.keys(): 
            return True 
        else: 
            return False