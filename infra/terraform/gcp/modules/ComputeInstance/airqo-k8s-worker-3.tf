resource "google_compute_instance" "airqo_k8s_worker_3" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      image = var.os["ubuntu-bionic"]
      size  = var.disk_size["large"]
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "airqo-k8s-worker-3"
  }

  can_ip_forward = true

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-custom-2-5376"

  name = "airqo-k8s-worker-3"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "airqo-k8s-cluster"
    network_ip         = "10.240.0.67"
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

  tags = ["airqo-k8s", "worker"]
  zone = var.zone
}
# terraform import google_compute_instance.airqo_k8s_worker_3 projects/${var.project-id}/zones/europe-west1-b/instances/airqo-k8s-worker-3
