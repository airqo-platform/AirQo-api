resource "google_bigquery_table" "checking" {
  dataset_id = "TestingRoles"
  project    = "airqo-250220"
  schema     = "null"
  table_id   = "Checking"
}
# terraform import google_bigquery_table.checking projects/airqo-250220/datasets/TestingRoles/tables/Checking
