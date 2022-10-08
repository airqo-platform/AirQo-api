resource "google_compute_instance" "airqo_stage_k8s_worker_0" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      size  = var.disk_size["medium"]
      type = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "airqo-stage-k8s-worker-0"
  }

  can_ip_forward = true

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-highmem-2"

  name = "airqo-stage-k8s-worker-0"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "airqo-k8s-cluster"
    network_ip         = "10.240.0.36"
    stack_type         = "IPV4_ONLY"
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
    scopes = ["https://www.googleapis.com/auth/compute", "https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-k8s-cluster", "worker"]
  zone = var.zone
}
# terraform import google_compute_instance.airqo_stage_k8s_worker_0 projects/${var.project-id}/zones/europe-west1-b/instances/airqo-stage-k8s-worker-0
