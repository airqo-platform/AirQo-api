resource "google_bigquery_table" "clean_census_data" {
  dataset_id = "thingspeak"

  external_data_configuration {
    autodetect = true

    csv_options {
      quote             = ""
      field_delimiter   = ","
      skip_leading_rows = 0
    }

    source_format = "CSV"
    source_uris   = ["https://drive.google.com/open?id=1o6UGL-Uw8HnSPP7jFuv15pS7aQuXMO-q"]
  }

  project  = "${var.project-id}"
  schema   = "[{\"mode\":\"NULLABLE\",\"name\":\"District\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"County\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"Subcounty\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"Parish\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"geometry\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"centroid\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"long\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"lat\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"km2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Total_population\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Total_House_hold\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Region\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"Electricity_National_Grid__Umeme_\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Electricity_Solar\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Electricity_Personal_Generator\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Electricity_Community_Thermal_Plant\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Gas\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Liquefied_Petroleun_Gas__Lpg_\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Biogas\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Paraffin_Stove\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Charcoal\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Firewood\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Cow_Dung\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Grass__Reeds_\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Other\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Other_25\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Other_26\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Other_27\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Dispose_in_gaden_do_not_burn_it\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Burn_solid_waste\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Bury_solid_waste\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Dispose_in_local_dump_local_urban_supervised\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Dispose_in_local_dump_not_local_urban_supervised\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Collected_by_waste_vendor\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Occupants_dispose_solid_waste_into_river_sea_s___\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Other_arrangements\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Inside_specific_room\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Inside_no_specific_room\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Outside_built\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Make_shift\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Open_spac\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Population_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"HouseHold_per_KM2\",\"type\":\"FLOAT\"}]"
  table_id = "clean_census_data"
}
# terraform import google_bigquery_table.clean_census_data projects/airqo-250220/datasets/thingspeak/tables/clean_census_data
