resource "google_compute_disk" "airqo_postgresql_db" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20211212"
  name                      = "airqo-postgresql-db"
  physical_block_size_bytes = 4096
  project                   = "airqo-250220"
  size                      = 50
  type                      = "pd-balanced"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.airqo_postgresql_db projects/airqo-250220/zones/europe-west1-b/disks/airqo-postgresql-db
