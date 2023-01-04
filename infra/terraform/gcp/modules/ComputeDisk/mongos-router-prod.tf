resource "google_compute_disk" "mongos_router_prod" {
  image                     = var.os["ubuntu-focal"]
  name                      = "mongos-router-prod"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["small"]
  type                      = "pd-standard"
  zone                      = var.zone
  description               = "Disk for the production mongodb sharded cluster mongos query router"
}
# terraform import google_compute_disk.mongos_router_prod projects/${var.project_id}/zones/europe-west1-b/disks/mongos-router-prod
