resource "google_storage_bucket" "prep_bucket" {
  force_destroy            = false
  location                 = "${var.location}"
  name                     = "prep-bucket"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.prep_bucket prep-bucket
