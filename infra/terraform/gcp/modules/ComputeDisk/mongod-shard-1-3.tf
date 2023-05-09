resource "google_compute_disk" "mongod_shard_1_3" {
  image                     = var.os["ubuntu-focal"]
  name                      = "mongod-shard-1-3"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-balanced"
  zone                      = var.zone["d"]
  description               = "Disk for a production mongodb sharded cluster shard instance"
}
# terraform import google_compute_disk.mongod_shard_1_3 projects/${var.project_id}/zones/${var.zone["b"]}/disks/mongod-shard-1-3
