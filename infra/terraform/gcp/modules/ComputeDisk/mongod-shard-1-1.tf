resource "google_compute_disk" "mongod_shard_1_1" {
  image                     = var.os["ubuntu-focal"]
  name                      = "mongod-shard-1-1"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-balanced"
  zone                      = var.zone
  description = "Disk for a production mongodb sharded cluster shard instance"
}
# terraform import google_compute_disk.mongod_shard_1_1 projects/${var.project_id}/zones/${var.zone}/disks/mongod-shard-1-1
