import kcca_device_measurements

"""
Entry point for the function
Each function must have the same name as the cloud function
"""


def kafka_kcca_device_measurements(event, context):
    kcca_device_measurements.get_kcca_device_measurements()

