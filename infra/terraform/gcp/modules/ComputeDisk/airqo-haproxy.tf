resource "google_compute_disk" "airqo_haproxy" {
  image                     = var.os["ubuntu-xenial"]
  name                      = "airqo-haproxy"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size                      = var.disk_size["tiny"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.airqo_haproxy projects/${var.project-id}/zones/europe-west1-b/disks/airqo-haproxy
