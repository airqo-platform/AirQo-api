resource "google_compute_disk" "device_registry_db" {
  image                     = var.os["ubuntu-focal"]
  name                      = "device-registry-db"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size                      = var.disk_size["large"]
  type                      = "pd-balanced"
  zone                      = var.zone
}
# terraform import google_compute_disk.device_registry_db projects/${var.project-id}/zones/europe-west1-b/disks/device-registry-db
