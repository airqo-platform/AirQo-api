resource "google_bigquery_dataset" "testingroles" {
  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }

  access {
    role          = "READER"
    special_group = "projectReaders"
  }

  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }

  dataset_id                 = "TestingRoles"
  delete_contents_on_destroy = false
  location                   = "US"
  project                    = "airqo-250220"
}
# terraform import google_bigquery_dataset.testingroles projects/airqo-250220/datasets/TestingRoles
