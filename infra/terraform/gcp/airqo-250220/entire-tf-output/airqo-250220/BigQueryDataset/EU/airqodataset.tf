resource "google_bigquery_dataset" "airqodataset" {
  access {
    role          = "OWNER"
    special_group = "projectOwners"
  }

  access {
    role          = "OWNER"
    user_by_email = "martin@airqo.net"
  }

  access {
    role          = "READER"
    special_group = "projectReaders"
  }

  access {
    role          = "WRITER"
    special_group = "projectWriters"
  }

  access {
    role          = "WRITER"
    user_by_email = "service-702081712633@gcp-sa-bigquerydatatransfer.iam.gserviceaccount.com"
  }

  dataset_id                      = "airqodataset"
  default_partition_expiration_ms = 5184000000
  default_table_expiration_ms     = 5184000000
  delete_contents_on_destroy      = false
  description                     = "Naguru II"
  location                        = "EU"
  project                         = "airqo-250220"
}
# terraform import google_bigquery_dataset.airqodataset projects/airqo-250220/datasets/airqodataset
