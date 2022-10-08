resource "google_storage_bucket" "artifacts_airqo_250220_appspot_com" {
  force_destroy            = false
  location                 = "US"
  name                     = "artifacts.airqo-250220.appspot.com"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.artifacts_airqo_250220_appspot_com artifacts.airqo-250220.appspot.com
