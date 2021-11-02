from datetime import datetime

from api.utils.dates import str_to_date

FREQUENCY_FORMAT_MAPPER = {
    'monthly': '%B %Y',
    'daily': '%Y-%m-%d',
}


def str_date_to_format_str(str_date, frequency):
    """Converts datetime to a string basing on the frequency passed."""

    default_format = '%Y-%m-%d %H:%M'

    date_format = FREQUENCY_FORMAT_MAPPER.get(frequency, default_format)

    return datetime.strftime(str_to_date(str_date), date_format)
