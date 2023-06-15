resource "google_compute_disk" "mongos_router_1" {
  snapshot                  = "https://www.googleapis.com/compute/v1/projects/${var.project_id}/global/snapshots/mongos-router-1"
  name                      = "mongos-router-1"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["small"]
  type                      = "pd-balanced"
  zone                      = var.zone["c"]
  description               = "Disk for the mongos-router-1 instance"
}
# terraform import google_compute_disk.mongos_router_1 projects/${var.project_id}/zones/${var.zone["b"]}/disks/mongos-router-1
