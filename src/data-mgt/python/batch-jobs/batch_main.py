from airqo_batch_insert import get_device_measurements
from config import configuration
from kcca_batch_insert import ProcessMeasurements
from utils import get_devices, filter_valid_devices, filter_valid_kcca_devices

if __name__ == "__main__":

    tenant = configuration.TENANT
    if not tenant:
        print("Tenant not specified")
        exit()

    if tenant.strip().lower() == "airqo":
        airqo_devices = get_devices(configuration.AIRQO_BASE_URL, "airqo")
        filtered_devices = filter_valid_devices(airqo_devices)

        if len(filtered_devices) > 0:
            get_device_measurements(filtered_devices)
        else:
            print("No valid devices")

    elif tenant.strip().lower() == "kcca":
        kcca_devices = get_devices(configuration.AIRQO_BASE_URL, "kcca")
        filtered_devices = filter_valid_kcca_devices(kcca_devices)
        if len(filtered_devices) > 0:
            process_measurements = ProcessMeasurements(filtered_devices)
            process_measurements.begin_fetch()
        else:
            print("No valid devices")
    else:
        print("Error", "Invalid Tenant", sep=" : ")
