def get_expected_records_count(mobility):
    """
    We are considering hourly values
    So that means that in a day, a static device should generate 24 records
    Mobile devices should generate 12 (half of that)
    """
    total_records_per_day = 24
    if mobility == 'Mobile':
        return total_records_per_day / 2
    return total_records_per_day
