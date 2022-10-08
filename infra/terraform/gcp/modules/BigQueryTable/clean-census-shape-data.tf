resource "google_bigquery_table" "clean_census_shape_data" {
  dataset_id = "thingspeak"

  external_data_configuration {
    autodetect = true

    csv_options {
      quote             = ""
      field_delimiter   = ","
      skip_leading_rows = 0
    }

    source_format = "CSV"
    source_uris   = ["https://drive.google.com/open?id=1ZFmPjimTNmYgIt-_aUlfk_CwMPN-clxT"]
  }

  project  = var.project-id
  schema   = "[{\"mode\":\"NULLABLE\",\"name\":\"District\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"County\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"Subcounty\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"Parish\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"geometry\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"centroid\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"long\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"lat\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"km2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Total_population\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Total_House_hold\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Region\",\"type\":\"STRING\"},{\"mode\":\"NULLABLE\",\"name\":\"Population_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"HouseHold_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Electricity_National_Grid__Umeme__per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Electricity_Solar_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Electricity_Personal_Generator_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Electricity_Community_Thermal_Plant_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Gas_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Liquefied_Petroleun_Gas__Lpg__per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Biogas_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Paraffin_Stove_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Charcoal_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Firewood_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Cow_Dung_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Grass__Reeds__per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Burn_solid_waste_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Dispose_in_gaden_do_not_burn_it_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Dispose_in_local_dump_local_urban_supervised_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Bury_solid_waste_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Collected_by_waste_vendor_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Occupants_dispose_solid_waste_into_river_sea_s_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Inside_specific_room_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Outside_built_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Make_shift_per_KM2\",\"type\":\"FLOAT\"},{\"mode\":\"NULLABLE\",\"name\":\"Open_spac_per_KM2\",\"type\":\"FLOAT\"}]"
  table_id = "clean_census_shape_data"
}
# terraform import google_bigquery_table.clean_census_shape_data projects/${var.project-id}/datasets/thingspeak/tables/clean_census_shape_data
