resource "google_storage_bucket" "prep_bucket" {
  force_destroy            = false
  location                 = "EU"
  name                     = "prep-bucket"
  project                  = "airqo-250220"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.prep_bucket prep-bucket
