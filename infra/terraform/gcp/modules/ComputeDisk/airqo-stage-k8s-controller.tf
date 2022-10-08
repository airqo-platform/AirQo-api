resource "google_compute_disk" "airqo_stage_k8s_controller" {
  image                     = "ubuntu-1804-bionic-v20210720"
  name                      = "airqo-stage-k8s-controller"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["medium"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.airqo_stage_k8s_controller projects/${var.project-id}/zones/europe-west1-b/disks/airqo-stage-k8s-controller
