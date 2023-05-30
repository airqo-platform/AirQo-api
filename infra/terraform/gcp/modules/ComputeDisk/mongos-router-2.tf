resource "google_compute_disk" "mongos_router_2_2" {
  image                     = var.os["ubuntu-focal"]
  name                      = "mongos-router-2"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["small"]
  type                      = "pd-balanced"
  zone                      = var.zone["d"]
  description               = "Disk for the mongodb sharded cluster mongos query router-2"
}
# terraform import google_compute_disk.mongos_router_2 projects/${var.project_id}/zones/${var.zone["b"]}/disks/mongos-router-2
