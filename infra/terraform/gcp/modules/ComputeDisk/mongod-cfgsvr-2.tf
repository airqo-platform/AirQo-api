resource "google_compute_disk" "mongod_cfgsvr_2" {
  image                     = var.os["ubuntu-focal"]
  name                      = "mongod-cfgsvr-2"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["medium"]
  type                      = "pd-balanced"
  zone                      = var.zone["c"]
  description               = "Disk for a production mongodb sharded cluster config server"
}
# terraform import google_compute_disk.mongod_cfgsvr_2 projects/${var.project_id}/zones/${var.zone["b"]}/disks/mongod-cfgsvr-2
