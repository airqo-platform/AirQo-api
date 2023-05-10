resource "google_compute_disk" "airqo_dev_haproxy" {
  image                     = var.os["ubuntu-focal"]
  name                      = "airqo-dev-haproxy"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-standard"
  zone                      = var.zone["b"]
  description               = "Disk for the airqo-dev-haproxy instance"
}
# terraform import google_compute_disk.airqo_dev_haproxy projects/${var.project_id}/zones/${var.zone["b"]}/disks/airqo-dev-haproxy