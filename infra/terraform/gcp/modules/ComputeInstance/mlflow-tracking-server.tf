resource "google_compute_instance" "mlflow_tracking_server" {
  boot_disk {
    auto_delete = true
    device_name = "mlflow-tracking-server"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/cos-cloud/global/images/cos-77-12371-1109-0"
      size  = 10
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/zones/us-central1-a/disks/mlflow-tracking-server"
  }

  machine_type = "e2-small"

  metadata = {
    startup-script-url = "gs://airqo-mlflow-artifacts/scripts/start_mlflow_tracking.sh"
  }

  name = "mlflow-tracking-server"

  network_interface {
    access_config {
      nat_ip       = "23.251.144.212"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/global/networks/default"
    network_ip         = "10.128.0.22"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/${var.project-id}/regions/us-central1/subnetworks/default"
    subnetwork_project = var.project-id
  }

  project = var.project-id

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "mlflow-tracking-sa@airqo-250220.iam.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["mlflow-tracking-server"]
  zone = "us-central1-a"
}
# terraform import google_compute_instance.mlflow_tracking_server projects/${var.project-id}/zones/us-central1-a/instances/mlflow-tracking-server
