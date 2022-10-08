resource "google_compute_disk" "airqo_k8s_worker_1" {
  image                     = var.os["ubuntu-bionic"]
  name                      = "airqo-k8s-worker-1"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size                      = var.disk_size["large"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.airqo_k8s_worker_1 projects/${var.project-id}/zones/europe-west1-b/disks/airqo-k8s-worker-1
