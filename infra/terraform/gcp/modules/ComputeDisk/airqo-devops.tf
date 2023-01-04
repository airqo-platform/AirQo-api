resource "google_compute_disk" "airqo_devops" {
  image                     = var.os["ubuntu-xenial"]
  name                      = "airqo-devops"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["large"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.airqo_devops projects/${var.project_id}/zones/us-central1-a/disks/airqo-devops
