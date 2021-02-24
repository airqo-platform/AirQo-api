def calculate_device_uptime(expected_total_records_count, actual_valid_records_count):
    device_uptime_in_percentage = round(
        ((actual_valid_records_count/expected_total_records_count) * 100), 2)
    if device_uptime_in_percentage > 100:
        device_uptime_in_percentage=100.00
    device_downtime_in_percentage = 100-device_uptime_in_percentage

    return device_uptime_in_percentage, device_downtime_in_percentage
