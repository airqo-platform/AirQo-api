resource "google_storage_bucket" "airqo_bucket" {
  force_destroy            = false
  location                 = "US"
  name                     = "airqo-bucket"
  project                  = "${var.project-id}"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.airqo_bucket airqo-bucket
