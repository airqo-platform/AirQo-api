resource "google_storage_bucket" "traffic_maps" {
  force_destroy            = false
  location                 = "US"
  name                     = "traffic_maps"
  project                  = "${var.project-id}"
  storage_class            = "NEARLINE"
}
# terraform import google_storage_bucket.traffic_maps traffic_maps
