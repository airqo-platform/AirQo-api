import pandas as pd


def compute_intra_sensor_correlation(data, pollutants: list):
    """
    Compute correlation of a device
    inputs: data (Columns => device, pollutants)
    pollutants: []
    outputs:
        device | pm2_5_pearson_correlation | pm10_pearson_correlation | r2 | s1_pm2_5 | s2_pm2_5 | s1_pm10 | s2_pm10

    Steps:
    1. For each device, Use pandas to compute pm2.5 and pm 10 pearson correlation
        pd.correlation()
        NB: Take note of null values.
    2. For each device, Compute r2 => square pm2_5_pearson_correlation => r2

    """
    pass


def compute_inter_sensor_correlation(statistics):

    """
    Compute correlation between devices
    inputs: statistics (device, s1_pm2_5 | s2_pm2_5 | s1_pm10 | s2_pm10, external_humidity, internal_humidity)
    outputs:
        a dataframe with the correlated data

    Steps:
    Use pandas to compute the correlation
    """
    pass


def compute_statistics(data):

    """
    Ref : https://docs.google.com/document/d/14Lli_xCeCq1a1JM2JkbCuF2FSqX3BtqkacxQWs9HCPc/edit#heading=h.3jnb6ajjwl2
    Compute correlation of a device
    inputs: data (Columns => device, s1_pm2_5 , s2_pm2_5 , s1_pm10 , s2_pm10, battery_voltage,
                    internal_temperature, internal_humidity and external_humidity, altitude, external_pressure
                    and external_temperature )
    outputs:
        device and  (mean, std, max, min) for s1_pm2_5, s2_pm2_5, s1_pm10 and s2_pm10, battery_voltage,
        internal  and external temperature, internal and external humidity, altitude, external pressure

    Steps:
    1. For each device, compute the statistics
    """

    pass


def compute_differences(statistics):
    """
    Computes differences
    inputs: statistics
    outputs:
        differences

    Steps:
    1. Use pandas to compute the differences
    """
    pass
def get_data(devices, start_date, end_date):
    """

    SELECT 
    timestamp, device_number, s1_pm2_5, s2_pm2_5, s1_pm10,
    s2_pm10, device_temperature as internal_temperature, device_humidity as internal_humidity,
    temperature as external_temperature, humidity as external_humidity, altitude, vapor_pressure
     FROM `airqo-250220.averaged_data.hourly_device_measurements`
     WHERE DATE(timestamp) >= "2023-01-15" and
     device_id in UNNEST(["aq_g5_38", "aq_g519", "aq_g5_63"])


    """

    data = pd.read_json("/Users/noah/airqo/AirQo-api/src/device-monitoring/collocation_test_data.json")
    return data

def data_completeness_report(devices: list, start_date: str, end_date: str, expected_number_of_records: int,
                             number_of_days: int, completeness_threshold: float):
    """
    Docs: https://docs.google.com/document/d/1RrHfHmRrxYGFtkMFyeBlbba8jmqmsFGI1QYsEaJcMLk/edit
    inputs:
        a list of devices,
        start date
        expected number of records in an hour
        number of days
        end date?
        completeness_threshold? : 0 - 100 (default value 80)
        -----------
        end date => end date is null ?? start date + number of days

    outputs: Dataframe
     device | % completeness | % missing | expected_records | hourly_actual_records_count | recommendation

    Steps:
    1. Querying tha data from the API or data warehouse
        user devices, start date, end date
        NB: remove duplicates (timestamp, device_number or name)
            Use hourly data
    2. Calculate number of expected records in the period for all devices. 24 * number of days (expected)
    3. Calculate number of Hourly Actual records that we sent by each device (actual)
    4. Compute completeness for each device => (actual/expected )* 100 (completeness)
    5. Compute Missing for each device => 100 - completeness (Missing)
    6. Compute Recommendation => Passed if completeness > completenessThreshold else Failed
    """
    pass


# @device_status_bp.route(routes.DEVICE_COLLOCATION, methods=['POST'])
def get_collocation():
    json_data = {}
    devices = json_data.get("devices", [])
    start_date = json_data.get("startDate", "")
    end_time = json_data.get("endDate", "")
    completeness_value = json_data.get("completeness_value", 80)
    correlation_value = json_data.get("correlation_value", 90)
    differences_value = json_data.get("differences_value", 5)
    pollutants = json_data.get("pollutants", ["pm2_5", "pm10"])

    """
       end date => end date is null ?? start date + number of days
    """
    data = get_data(devices, start_date, end_time)


    for device in devices:
        data += get_data(device, start_date, end_time)

    # calculate completeness
    completeness_report = data_completeness_report(data, completeness_value)
    failed_devices_data = completeness_report["completeness" < completeness_value]
    passed_devices_data = completeness_report["completeness" >= completeness_value]

    # intra sensor correlation
    intra_sensor_correlation = []
    for device in devices:
        intra_sensor_correlation[device] = compute_intra_sensor_correlation(device)

    # remove devices that fail intra sensor correlation based on all the {pollutants}
    passed_devices_data = passed_devices_data["correlation" < correlation_value]

    # inter sensor correlation
    inter_sensor_correlation = compute_inter_sensor_correlation(data)

    # calculate statistics
    statistics = compute_statistics(passed_devices_data)

    # compute differences
    differences = compute_differences(statistics)






    # remove devices with a huge difference
    differences = differences["difference" > differences_value]

    response = dict(message="devices collocation successful",
                    data={"failed_devices": failed_devices_data, "passed_devices": passed_devices_data, "report": {
                        "statistics": statistics,
                        "differences": differences,
                        "inter_sensor_correlation": inter_sensor_correlation,
                        "intra_sensor_correlation": intra_sensor_correlation,
                        "completeness_report": completeness_report
                    }}
                    )

