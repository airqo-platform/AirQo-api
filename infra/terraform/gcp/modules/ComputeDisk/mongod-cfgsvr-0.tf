resource "google_compute_disk" "mongod_cfgsvr_0" {
  image                     = var.os["ubuntu-focal"]
  name                      = "mongod-cfgsvr-0"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["small"]
  type                      = "pd-ssd"
  zone                      = var.zone["b"]
  description               = "Disk for a mongodb sharded cluster config server"
}
# terraform import google_compute_disk.mongod_cfgsvr_0 projects/${var.project_id}/zones/${var.zone["b"]}/disks/mongod-cfgsvr-0
