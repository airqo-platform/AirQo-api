resource "google_storage_bucket" "kcca_device_measurements" {
  force_destroy            = false
  location                 = "US"
  name                     = "kcca_device_measurements"
  project                  = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.kcca_device_measurements kcca_device_measurements
