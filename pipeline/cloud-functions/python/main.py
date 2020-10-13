from cloud_function_process_kcca_device_measurements import get_kcca_device_data

"""
Entry point for all functions
Each function must have the same name as its cloud function
"""


def get_kcca_device_measurements(event, context):
    get_kcca_device_data()

