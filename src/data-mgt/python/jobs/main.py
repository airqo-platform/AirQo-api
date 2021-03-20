import kcca_device_measurements
import airqo_device_measurements

"""
Entry point for all functions
Each function must have the same name as the cloud function
"""


def get_airqo_device_measurements(event, context):
    airqo_device_measurements.get_airqo_device_measurements()


def get_kcca_device_measurements(event, context):
    kcca_device_measurements.get_kcca_device_measurements()

