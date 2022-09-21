resource "google_storage_bucket" "dataproc_staging_us_central1_702081712633_czv5tnbc" {
  force_destroy            = false
  location                 = "US-CENTRAL1"
  name                     = "dataproc-staging-us-central1-702081712633-czv5tnbc"
  project                  = "airqo-250220"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.dataproc_staging_us_central1_702081712633_czv5tnbc dataproc-staging-us-central1-702081712633-czv5tnbc
