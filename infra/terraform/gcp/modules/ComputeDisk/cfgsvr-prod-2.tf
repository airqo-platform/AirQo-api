resource "google_compute_disk" "cfgsvr_prod_2" {
  image                     = var.os["ubuntu-focal"]
  name                      = "cfgsvr-prod-2"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["small"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.cfgsvr_prod_2 projects/${var.project_id}/zones/europe-west1-b/disks/cfgsvr-prod-2
