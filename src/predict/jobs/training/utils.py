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
