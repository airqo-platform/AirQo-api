resource "google_storage_bucket" "airqo_250220_appspot_com" {
  force_destroy            = false
  location                 = var.location
  name                     = "${var.project-id}.appspot.com"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.${var.project-id}_appspot_com ${var.project-id}.appspot.com
