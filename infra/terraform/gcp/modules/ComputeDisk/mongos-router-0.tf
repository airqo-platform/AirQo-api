resource "google_compute_disk" "mongos_router_0" {
  snapshot                  = "https://www.googleapis.com/compute/v1/projects/${var.project_id}/global/snapshots/mongos-router-0"
  name                      = "mongos-router-0"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["large"]
  type                      = "pd-balanced"
  zone                      = var.zone["b"]
  description               = "Disk for the mongos-router-0 instance"
}
# terraform import google_compute_disk.mongos_router_0 projects/${var.project_id}/zones/${var.zone["b"]}/disks/mongos-router-0
