resource "google_compute_disk" "cfgsvr_stage_1" {
  image                     = "ubuntu-1804-bionic-v20220616"
  name                      = "cfgsvr-stage-1"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["small"]
  type                      = "pd-balanced"
  zone                      = var.zone
}
# terraform import google_compute_disk.cfgsvr_stage_1 projects/${var.project-id}/zones/europe-west1-b/disks/cfgsvr-stage-1
