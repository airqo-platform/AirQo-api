resource "google_storage_bucket" "airqo_250220_appspot_com" {
  force_destroy            = false
  location                 = "US"
  name                     = "${var.project-id}.appspot.com"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_250220_appspot_com airqo-250220.appspot.com
