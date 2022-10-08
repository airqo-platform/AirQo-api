resource "google_compute_instance_template" "airqo_k8s_dev_worker" {
  confidential_instance_config {
    enable_confidential_compute = false
  }

  disk {
    auto_delete  = true
    boot         = true
    device_name  = "instance-template-1"
    disk_size_gb = 100
    disk_type    = "pd-standard"
    mode         = "READ_WRITE"
    source_image = "projects/${var.project-id}/global/images/airqo-k8s-dev-worker"
    type         = "PERSISTENT"
  }

  labels = {
    managed-by-cnrm = "true"
  }

  machine_type = "custom-2-6144"
  name         = "airqo-k8s-dev-worker"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/airqo-k8s-cluster"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/regions/europe-west1/subnetworks/k8s-nodes"
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
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "${var.project-number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/compute", "https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-k8s", "http-server", "https-server", "worker"]
}
# terraform import google_compute_instance_template.airqo_k8s_dev_worker projects/${var.project-id}/global/instanceTemplates/airqo-k8s-dev-worker
