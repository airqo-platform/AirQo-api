resource "google_compute_instance" "cfgsvr_stage_2" {
  boot_disk {
    auto_delete = true
    device_name = "cfgsvr-dev-2"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20220616"
      size  = 20
      type  = "pd-balanced"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/cfgsvr-stage-2"
  }

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-medium"

  name = "cfgsvr-stage-2"

  network_interface {
    access_config {
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.73"
    stack_type         = "IPV4_ONLY"
    subnetwork         = "https://www.googleapis.com/compute/v1/projects/airqo-250220/regions/europe-west1/subnetworks/k8s-nodes"
    subnetwork_project = "airqo-250220"
  }

  project = "airqo-250220"

  reservation_affinity {
    type = "ANY_RESERVATION"
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    provisioning_model  = "STANDARD"
  }

  service_account {
    email  = "702081712633-compute@developer.gserviceaccount.com"
    scopes = ["https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring.write", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol", "https://www.googleapis.com/auth/trace.append"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-shard", "http-server", "https-server"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.cfgsvr_stage_2 projects/airqo-250220/zones/europe-west1-b/instances/cfgsvr-stage-2
