resource "google_bigquery_table" "checking" {
  dataset_id = "TestingRoles"
  project    = var.project-id
  schema     = "null"
  table_id   = "Checking"
}
# terraform import google_bigquery_table.checking projects/${var.project-id}/datasets/TestingRoles/tables/Checking
