resource "google_storage_bucket" "kcca_device_measurements" {
  force_destroy            = false
  location                 = "US"
  name                     = "kcca_device_measurements"
  project                  = var.project-id
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.kcca_device_measurements kcca_device_measurements
