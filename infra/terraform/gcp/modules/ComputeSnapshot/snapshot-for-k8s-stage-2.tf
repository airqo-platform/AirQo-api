resource "google_compute_snapshot" "snapshot_for_k8s_stage_2" {
  name              = "snapshot-for-k8s-stage-2"
  project           = "${var.project-id}"
  source_disk       = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-stage-k8s-worker-2"
  storage_locations = ["us"]
}
# terraform import google_compute_snapshot.snapshot_for_k8s_stage_2 projects/airqo-250220/global/snapshots/snapshot-for-k8s-stage-2
