resource "google_storage_bucket" "met_bucket" {
  force_destroy            = false
  location                 = "EU"
  name                     = "met_bucket"
  project                  = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.met_bucket met_bucket
