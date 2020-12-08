from controllers/transform import process_kcca_device_data

"""
Entry point for all functions
Each function must have the same name as its cloud function
"""


def get_kcca_device_measurements(event, context):
    process_kcca_device_data()


# if __name__ == "__main__":
#     process_kcca_device_data()
