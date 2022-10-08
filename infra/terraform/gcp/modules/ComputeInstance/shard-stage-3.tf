resource "google_compute_instance" "shard_stage_3" {
  boot_disk {
    auto_delete = true
    device_name = "shard-dev-1"

    initialize_params {
      image = var.os["ubuntu-bionic"]
      size  = var.disk_size["tiny"]
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "shard-stage-3"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-medium"

  name = "shard-stage-3"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "airqo-k8s-cluster"
    network_ip         = "10.240.0.97"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "k8s-nodes"
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
    email  = "${var.project-number}-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-shard", "http-server", "https-server"]
  zone = var.zone
}
# terraform import google_compute_instance.shard_stage_3 projects/${var.project-id}/zones/europe-west1-b/instances/shard-stage-3
