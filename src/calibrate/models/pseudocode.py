def compute_log_ratios(self, device_name):
        """
        get the distance using GPS cordinates
        compute the ratios
        How frequent will the job run? a day?
        """
        gps = get_gps(device_name)
        log_ratio = generate_ratio(gps, mobile)
        save_log_ratio(device_name, log_ratio)
        # stored in the log_ratios collection
        # {
        #   time:
        #   id:
        #   log_ratio: 2131
        #   device_name: aq_01
        # }

    def compute_calibration(self, raw_value, datetime, device_name):
        """
        Assumption is that the log ratios were stored/updated in the components collection
        we get the log ratio using the sensor/component ID
        """
        device_name = get_device_name(sensor_id)
        log_ratio = log_ratio_model(device_name)
        calibrated_value = float(raw_value) * log_ratio
        result = {"calibrated_value": calibrated_value,
                  "calibrated_standard_error": calibrated_standard_error, "sensor_id": sensor_id}
        return result

    def store_calibraton(self, sensor_id, calibrated_value):
        """
        Store the calibration inside the Events collection
        """
        Events(calibrated_value, sensor_id)
