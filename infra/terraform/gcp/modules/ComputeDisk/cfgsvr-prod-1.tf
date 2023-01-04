resource "google_compute_disk" "cfgsvr_prod_1" {
  image                     = var.os["ubuntu-focal"]
  name                      = "cfgsvr-prod-1"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.cfgsvr_prod_1 projects/${var.project_id}/zones/europe-west1-b/disks/cfgsvr-prod-1
