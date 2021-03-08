import kcca_device_measurements
import airqo_device_measurements

"""
Entry point for all functions
Each function must have the same name as the cloud function
"""


def get_airqo_device_measurements(event, context):
    airqo_device_measurements.process_airqo_device_data()


def get_kcca_device_measurements(event, context):
    kcca_device_measurements.process_kcca_device_data()

