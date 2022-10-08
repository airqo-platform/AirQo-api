resource "google_storage_bucket" "met_bucket" {
  force_destroy            = false
  location                 = "${var.location}"
  name                     = "met_bucket"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.met_bucket met_bucket
