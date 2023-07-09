resource "google_compute_disk" "ansible_controller" {
  snapshot                  = "https://www.googleapis.com/compute/v1/projects/${var.project_id}/global/snapshots/ansible-controller"
  name                      = "ansible-controller"
  physical_block_size_bytes = 4096
  project                   = var.project_id
  size                      = var.disk_size["small"]
  type                      = "pd-standard"
  zone                      = var.zone["b"]
  description               = "Disk for the ansible-controller instance"
}
# terraform import google_compute_disk.ansible_controller projects/${var.project_id}/zones/${var.zone["b"]}/disks/ansible-controller