resource "google_compute_instance_template" "shard_instance_template" {
  confidential_instance_config {
    enable_confidential_compute = false
  }

  disk {
    auto_delete  = true
    boot         = true
    device_name  = "shard-instance-template"
    disk_size_gb  = var.disk_size["medium"]
    disk_type    = "pd-balanced"
    mode         = "READ_WRITE"
    source_image = var.os["ubuntu-bionic"]
    type         = "PERSISTENT"
  }

  labels = {
    managed-by-cnrm = "true"
  }

  machine_type = "e2-custom-4-8192"
  name         = "shard-instance-template"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "airqo-k8s-cluster"
    subnetwork         = "k8s-nodes"
    subnetwork_project = var.project-id
  }

  project = var.project-id
  region  = "europe-west1"

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  service_account {
    email  = "${var.project-number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-shard", "http-server", "https-server"]
}
# terraform import google_compute_instance_template.shard_instance_template projects/${var.project-id}/global/instanceTemplates/shard-instance-template
