resource "google_storage_bucket" "traffic_maps" {
  force_destroy            = false
  location                 = "US"
  name                     = "traffic_maps"
  project                  = "airqo-250220"
  # Argument "public_access_prevention" not expected here.
# public_access_prevention = "inherited"
  storage_class            = "NEARLINE"
}
# terraform import google_storage_bucket.traffic_maps traffic_maps
