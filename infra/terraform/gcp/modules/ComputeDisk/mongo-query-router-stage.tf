resource "google_compute_disk" "mongo_query_router_stage" {
  image                     = "ubuntu-1804-bionic-v20220616"
  name                      = "mongo-query-router-stage"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["tiny"]
  type                      = "pd-balanced"
  zone                      = var.zone
}
# terraform import google_compute_disk.mongo_query_router_stage projects/${var.project-id}/zones/europe-west1-b/disks/mongo-query-router-stage
