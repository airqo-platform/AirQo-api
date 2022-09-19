resource "google_compute_instance" "airqo_stage_k8s_worker_0" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      size = 100
      type = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-stage-k8s-worker-0"
  }

  can_ip_forward = true

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-highmem-2"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBICIEfi+ri+xPjFgeezvUnIXub0oFaSxyVkCTbKGt+LTcfVKlmYnvnUUvOD7eSd7OhBHExGBFjJ601P3KBR1LDw= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-28T08:10:23+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCU0wEF13IWbumPRofLgmnYHlPv3P6mKJwD2IP2P/fy7lNrfrwJFfTWGhz8115cNzm2zPBUrC5KKsZb2QLuJjQeF23kZO5XQ5SqL3B8wcj0iUXBiMXkUfYS04PU0PrSBKEtzavGmB7FE0p6V4+AF3vI0YwKtefUgwNV203H2mcI1fSSwlYUEQk8IeDeg2gRLMeFeF47zs9Sje/ooVM+D069eoh0vTusB6HwafSWUFFTzgkT95u94GU7S1rpmaaiv1FHczS64QA/83EGh+M30EfZGS8/3fqXwcv5FHspdnQXBXXSW8PRs+bqntecP4uWCOkj5cuGrYcmRos4/SBfL1Wl google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-28T08:10:39+0000\"}"
  }

  name = "airqo-stage-k8s-worker-0"

  network_interface {
    access_config {
      nat_ip       = "35.205.96.82"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.36"
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
    scopes = ["https://www.googleapis.com/auth/compute", "https://www.googleapis.com/auth/devstorage.read_only", "https://www.googleapis.com/auth/logging.write", "https://www.googleapis.com/auth/monitoring", "https://www.googleapis.com/auth/service.management.readonly", "https://www.googleapis.com/auth/servicecontrol"]
  }

  shielded_instance_config {
    enable_integrity_monitoring = true
    enable_vtpm                 = true
  }

  tags = ["airqo-k8s-cluster", "worker"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_stage_k8s_worker_0 projects/airqo-250220/zones/europe-west1-b/instances/airqo-stage-k8s-worker-0
