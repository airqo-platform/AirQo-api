resource "google_compute_disk" "mongos_router" {
  image                     = var.os["ubuntu-focal"]
  name                      = "mongos-router"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["small"]
  type                      = "pd-balanced"
  zone                      = var.zone
  description               = "Disk for the production mongodb sharded cluster mongos query router"
}
# terraform import google_compute_disk.mongos_router projects/${var.project_id}/zones/${var.zone}/disks/mongos-router
