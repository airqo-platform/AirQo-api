resource "google_compute_disk" "airqo_k8s_worker_4" {
  image                     = var.os["ubuntu-focal"]
  name                      = "airqo-k8s-worker-4"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-standard"
  zone                      = var.zone["b"]
  description               = "Disk for the airqo-k8s-worker-4 instance"
}
# terraform import google_compute_disk.airqo_k8s_worker_4 projects/${var.project_id}/zones/${var.zone["b"]}/disks/airqo-k8s-worker-4