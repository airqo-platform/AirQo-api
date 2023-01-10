resource "google_compute_disk" "ansible_controller" {
  image                     = var.os["ubuntu-focal"]
  name                      = "ansible-controller"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size                      = var.disk_size["small"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.ansible_controller projects/${var.project-id}/zones/europe-west1-b/disks/ansible-controller
