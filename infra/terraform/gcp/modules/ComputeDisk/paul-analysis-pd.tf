resource "google_compute_disk" "paul_analysis_pd" {
  description               = "Persistent disk for a Google Cloud Datalab instance"
  name                      = "paul-analysis-pd"
  physical_block_size_bytes = 4096
  project                   = var.project-id
  size      = var.disk_size["large"]
  type                      = "pd-standard"
  zone                      = var.zone
}
# terraform import google_compute_disk.paul_analysis_pd projects/${var.project-id}/zones/us-east1-b/disks/paul-analysis-pd
