resource "google_storage_bucket" "api_keys_bucket" {
  force_destroy            = false
  location                 = "US"
  name                     = "api-keys-bucket"
  project                  = "airqo-250220"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.api_keys_bucket api-keys-bucket
