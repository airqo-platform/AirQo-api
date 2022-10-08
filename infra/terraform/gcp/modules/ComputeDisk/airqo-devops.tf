resource "google_compute_disk" "airqo_devops" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1604-xenial-v20200129"
  name                      = "airqo-devops"
  physical_block_size_bytes = 4096
  project                   = "${var.project-id}"
  size                      = 200
  type                      = "pd-standard"
  zone                      = "us-central1-a"
}
# terraform import google_compute_disk.airqo_devops projects/airqo-250220/zones/us-central1-a/disks/airqo-devops
