resource "google_compute_disk" "auth_service_db" {
  image                     = "ubuntu-1804-bionic-v20210504"
  name                      = "auth-service-db"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["medium"]
  type                      = "pd-balanced"
  zone                      = var.zone
}
# terraform import google_compute_disk.auth_service_db projects/${var.project-id}/zones/europe-west1-b/disks/auth-service-db
