resource "google_compute_disk" "shard_prod_3" {
  image                     = var.os["ubuntu-focal"]
  name                      = "shard-prod-3"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.shard_prod_3 projects/${var.project_id}/zones/europe-west1-b/disks/shard-prod-3
