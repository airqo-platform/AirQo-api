resource "google_bigquery_dataset" "datawarehouse" {
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

  dataset_id                 = "datawarehouse"
  delete_contents_on_destroy = false
  location                   = "US"
  project                    = "${var.project-id}"
}
# terraform import google_bigquery_dataset.datawarehouse projects/airqo-250220/datasets/datawarehouse
