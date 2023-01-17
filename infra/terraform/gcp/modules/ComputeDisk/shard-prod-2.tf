resource "google_compute_disk" "shard_prod_2" {
  image                     = var.os["ubuntu-focal"]
  name                      = "shard-prod-2"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-balanced"
  zone                      = var.zone
  description               = "Disk for a production mongodb sharded cluster shard instance"
}
# terraform import google_compute_disk.shard_prod_2 projects/${var.project_id}/zones/europe-west1-b/disks/shard-prod-2
