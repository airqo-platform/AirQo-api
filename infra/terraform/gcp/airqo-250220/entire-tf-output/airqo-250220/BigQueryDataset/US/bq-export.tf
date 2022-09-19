resource "google_bigquery_dataset" "bq_export" {
  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }

  access {
    role          = "OWNER"
    user_by_email = "paul@airqo.net"
  }

  access {
    role          = "READER"
    special_group = "projectReaders"
  }

  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }

  dataset_id                 = "bq_export"
  delete_contents_on_destroy = false
  location                   = "US"
  project                    = "airqo-250220"
}
# terraform import google_bigquery_dataset.bq_export projects/airqo-250220/datasets/bq_export
