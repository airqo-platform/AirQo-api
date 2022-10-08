resource "google_compute_disk" "temp_calibrate_service" {
  image                     = var.os["ubuntu-focal"]
  name                      = "temp-calibrate-service"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size                      = var.disk_size["tiny"]
  type                      = "pd-balanced"
  zone                      = var.zone
}
# terraform import google_compute_disk.temp_calibrate_service projects/${var.project-id}/zones/europe-west1-b/disks/temp-calibrate-service
