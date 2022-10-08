resource "google_compute_disk" "airqo_k8s_pd_storage" {
  description               = "Persistent disk storage to be consumed by k8s"
  name                      = "airqo-k8s-pd-storage"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["small"]
  type                      = "pd-standard"
  zone                      = "${var.zone}"
}
# terraform import google_compute_disk.airqo_k8s_pd_storage projects/${var.project-id}/zones/europe-west1-b/disks/airqo-k8s-pd-storage
