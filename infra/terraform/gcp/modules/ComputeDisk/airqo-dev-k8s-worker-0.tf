resource "google_compute_disk" "airqo_dev_k8s_worker_0" {
  image                     = var.os["ubuntu-jammy"]
  name                      = "airqo-dev-k8s-worker-0"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-standard"
  zone                      = var.zone["b"]
  description               = "Disk for the airqo-dev-k8s-worker-0 instance"
}
# terraform import google_compute_disk.airqo_dev_k8s_worker_0 projects/${var.project_id}/zones/${var.zone["b"]}/disks/airqo-dev-k8s-worker-0