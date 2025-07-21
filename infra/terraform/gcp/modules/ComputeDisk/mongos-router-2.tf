resource "google_compute_disk" "mongos_router_2" {
  snapshot                  = "https://www.googleapis.com/compute/v1/projects/${var.project_id}/global/snapshots/mongos-router-2"
  name                      = "mongos-router-2"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["small"]
  type                      = "pd-balanced"
  zone                      = var.zone["d"]
  description               = "Disk for the mongos-router-2 instance"
}
# terraform import google_compute_disk.mongos_router_2 projects/${var.project_id}/zones/${var.zone["b"]}/disks/mongos-router-2
