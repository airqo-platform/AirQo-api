resource "google_storage_bucket" "airqo_250220_cloudbuild" {
  force_destroy            = false
  location                 = "US"
  name                     = "airqo-250220_cloudbuild"
  project                  = "airqo-250220"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_250220_cloudbuild airqo-250220_cloudbuild
