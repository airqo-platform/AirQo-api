resource "google_bigquery_dataset" "consolidated_data" {
  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }

  access {
    role          = "OWNER"
    user_by_email = "noah@airqo.net"
  }

  access {
    role          = "READER"
    special_group = "projectReaders"
  }

  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }

  dataset_id                 = "consolidated_data"
  delete_contents_on_destroy = false
  location                   = "EU"
  project                    = "airqo-250220"
}
# terraform import google_bigquery_dataset.consolidated_data projects/airqo-250220/datasets/consolidated_data
