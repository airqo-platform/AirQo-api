resource "google_bigquery_table" "testcreate" {
  dataset_id = "TestingRoles"
  project    = "airqo-250220"
  schema     = "[{\"name\":\"fName\",\"type\":\"STRING\"}]"
  table_id   = "testCreate"
}
# terraform import google_bigquery_table.testcreate projects/airqo-250220/datasets/TestingRoles/tables/testCreate
