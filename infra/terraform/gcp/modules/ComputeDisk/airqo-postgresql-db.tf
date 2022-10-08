resource "google_compute_disk" "airqo_postgresql_db" {
  image                     = "ubuntu-2004-focal-v20211212"
  name                      = "airqo-postgresql-db"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["small"]
  type                      = "pd-balanced"
  zone                      = var.zone
}
# terraform import google_compute_disk.airqo_postgresql_db projects/${var.project-id}/zones/europe-west1-b/disks/airqo-postgresql-db
