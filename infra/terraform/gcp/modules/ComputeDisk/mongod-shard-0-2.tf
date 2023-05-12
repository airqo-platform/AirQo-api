resource "google_compute_disk" "mongod_shard_1_2" {
  image                     = var.os["ubuntu-focal"]
  name                      = "mongod-shard-0-2"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["large"]
  type                      = "pd-ssd"
  zone                      = var.zone["d"]
  description               = "Disk for a mongodb sharded cluster shard instance"
}
# terraform import google_compute_disk.mongod_shard_1_2 projects/${var.project_id}/zones/${var.zone["b"]}/disks/mongod-shard-0-2
