resource "google_compute_disk" "mongo_query_router_dev" {
  image                     = var.os["ubuntu-bionic"]
  name                      = "mongo-query-router-dev"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size                      = var.disk_size["tiny"]
  type                      = "pd-balanced"
  zone                      = var.zone
}
# terraform import google_compute_disk.mongo_query_router_dev projects/${var.project-id}/zones/europe-west1-b/disks/mongo-query-router-dev
