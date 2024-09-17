class MlUtils_Satellilte:
    @staticmethod
    def preprocess_data(data, data_frequency, job_type):


        required_columns = {
        'site_latitude','site_longitude','city','country','hour',
        'sulphurdioxide_so2_column_number_density','sulphurdioxide_so2_column_number_density_amf',
        'sulphurdioxide_so2_slant_column_number_density','sulphurdioxide_cloud_fraction',
        'sulphurdioxide_sensor_azimuth_angle','sulphurdioxide_sensor_zenith_angle',
        'sulphurdioxide_solar_azimuth_angle','sulphurdioxide_solar_zenith_angle',
        'sulphurdioxide_so2_column_number_density_15km','month','carbonmonoxide_co_column_number_density',
        'carbonmonoxide_h2o_column_number_density','carbonmonoxide_cloud_height','carbonmonoxide_sensor_altitude',
        'carbonmonoxide_sensor_azimuth_angle','carbonmonoxide_sensor_zenith_angle','carbonmonoxide_solar_azimuth_angle',
        'carbonmonoxide_solar_zenith_angle','nitrogendioxide_no2_column_number_density',
        'nitrogendioxide_tropospheric_no2_column_number_density','nitrogendioxide_stratospheric_no2_column_number_density',
        'nitrogendioxide_no2_slant_column_number_density','nitrogendioxide_tropopause_pressure',
        'nitrogendioxide_absorbing_aerosol_index','nitrogendioxide_cloud_fraction','nitrogendioxide_sensor_altitude',
        'nitrogendioxide_sensor_azimuth_angle','nitrogendioxide_sensor_zenith_angle','nitrogendioxide_solar_azimuth_angle'
        ,'nitrogendioxide_solar_zenith_angle','formaldehyde_tropospheric_hcho_column_number_density',
        'formaldehyde_tropospheric_hcho_column_number_density_amf','formaldehyde_hcho_slant_column_number_density',
        'formaldehyde_cloud_fraction','formaldehyde_solar_zenith_angle','formaldehyde_solar_azimuth_angle',
        'formaldehyde_sensor_zenith_angle','formaldehyde_sensor_azimuth_angle','uvaerosolindex_absorbing_aerosol_index',
        'uvaerosolindex_sensor_altitude','uvaerosolindex_sensor_azimuth_angle','uvaerosolindex_sensor_zenith_angle'
        ,'uvaerosolindex_solar_azimuth_angle','uvaerosolindex_solar_zenith_angle','ozone_o3_column_number_density',
        'ozone_o3_column_number_density_amf','ozone_o3_slant_column_number_density','ozone_o3_effective_temperature',
        'ozone_cloud_fraction','ozone_sensor_azimuth_angle','ozone_sensor_zenith_angle','ozone_solar_azimuth_angle',
        'ozone_solar_zenith_angle,cloud_cloud_fraction','cloud_cloud_top_pressure','cloud_cloud_top_height',
        'cloud_cloud_base_pressure','cloud_cloud_base_height','cloud_cloud_optical_depth','cloud_surface_albedo'
        ,'cloud_sensor_azimuth_angle','cloud_sensor_zenith_angle','cloud_solar_azimuth_angle','cloud_solar_zenith_angle',
        'DayOfYear','DayOfWeek','Day','pm2_5','ID',"date"
        }
        if not required_columns.issubset(data.columns):
            missing_columns = required_columns.difference(data.columns)
            raise ValueError(
                f"Provided dataframe missing necessary columns: {', '.join(missing_columns)}"
            )
        try:
            data["date"] = pd.to_datetime(data["date"])
        except ValueError as e:
            raise ValueError(
                "datetime conversion error, please provide timestamp in valid format"
            )
        group_columns = (
            ["ID"] + additional_columns
            if job_type == "prediction"
            else ["ID"]
        )
        data["pm2_5"] = data.groupby(group_columns)["pm2_5"].transform(
            lambda x: x.interpolate(method="linear", limit_direction="both")
        )
        if data_frequency == "daily":
            data = (
                data.groupby(group_columns)
                .resample("D", on="date")
                .mean(numeric_only=True)
            )
            data.reset_index(inplace=True)
        data["pm2_5"] = data.groupby(group_columns)["pm2_5"].transform(
            lambda x: x.interpolate(method="linear", limit_direction="both")
        )
        data = data.dropna(subset=["pm2_5"])
        return data
    
    @staticmethod
    def train_and_save_forecast_models(training_data, frequency):
        """
        Perform the actual training for hourly data
        """
        training_data.dropna(subset=["ID"], inplace=True)
        training_data["date"] = pd.to_datetime(training_data["date"])
        features = [
            c
            for c in training_data.columns
            if c not in ["date", "pm2_5", "latitude", "longitude","ID"]
        ]
        print(features)

        target_col = "pm2_5"
        train_data = validation_data = test_data = pd.DataFrame()
        for device in training_data["ID"].unique():
            device_df = training_data[training_data["ID"] == device]
            months = device_df["date"].dt.month.unique()
            train_months = months[:8]
            val_months = months[8:9]
            test_months = months[9:]

            train_df = device_df[device_df["date"].dt.month.isin(train_months)]
            val_df = device_df[device_df["date"].dt.month.isin(val_months)]
            test_df = device_df[device_df["date"].dt.month.isin(test_months)]

            train_data = pd.concat([train_data, train_df])
            validation_data = pd.concat([validation_data, val_df])
            test_data = pd.concat([test_data, test_df])

        train_data.drop(columns=["date", "ID"], axis=1, inplace=True)
        validation_data.drop(columns=["date", "ID"], axis=1, inplace=True)
        test_data.drop(columns=["date", "ID"], axis=1, inplace=True)

        train_target, validation_target, test_target = (
            train_data[target_col],
            validation_data[target_col],
            test_data[target_col],
        )

        sampler = optuna.samplers.TPESampler()
        pruner = optuna.pruners.SuccessiveHalvingPruner(
            min_resource=10, reduction_factor=2, min_early_stopping_rate=0
        )
        study = optuna.create_study(
            direction="minimize", study_name="LGBM", sampler=sampler, pruner=pruner
        )
