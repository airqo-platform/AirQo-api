resource "google_storage_bucket" "artifacts_airqo_250220_appspot_com" {
  force_destroy            = false
  location                 = var.location
  name                     = "artifacts.${var.project-id}.appspot.com"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.artifacts_airqo_250220_appspot_com artifacts.${var.project-id}.appspot.com
