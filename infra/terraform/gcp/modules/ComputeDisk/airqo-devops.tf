resource "google_compute_disk" "airqo_devops" {
  image                     = "ubuntu-1604-xenial-v20200129"
  name                      = "airqo-devops"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["large"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.airqo_devops projects/${var.project-id}/zones/us-central1-a/disks/airqo-devops
