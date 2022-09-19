resource "google_compute_instance" "airqo_stage_k8s_worker_2" {
  boot_disk {
    auto_delete = true
    device_name = "airqo-stage-k8s-worker-2"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20220712"
      size  = 100
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-stage-k8s-worker-2"
  }

  can_ip_forward = true

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-standard-2"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBHrpO0w9+o1ffpvEZ9kbvP1/thv9cAajLpguuMfZvYoNXqTfZxJe97z59XeDoMXnv8mnMZkBP139gs0j7V4BW9E= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-21T13:43:28+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAGrW97FxY03+npijnE3c4qWgm4CvQYVopf8xb08cpjH5cC5V9K3he7pQQMoecWwGheL9UIqJvk26hvVCOQw0cSACsaXbvl6pB3u3YyTf+ypliJpKDBVYOd2zY+1TmJXCZZUeXZX/LR6wvgHp/2PQKmtMtO/eq+aLZ8m1LhGezVuKcZOLVZoE4Npn+Dxz8vGYtjtLb5beUid0KEtYbhLuE70HE4DHdxegc+ewoaNqxWEZolGVGggyyjdgqiXgGSsGzSCkGQNGeA8PNFZtmaf0HnFkGshSuzHBnA8sx6ttPs0/0nN4ITm8jUpm3cIV3SwGgPxFTFQvodSG7A2N6Ahow6c= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-07-21T13:43:44+0000\"}"
  }

  name = "airqo-stage-k8s-worker-2"

  network_interface {
    access_config {
      nat_ip       = "34.77.118.157"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.70"
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
# terraform import google_compute_instance.airqo_stage_k8s_worker_2 projects/airqo-250220/zones/europe-west1-b/instances/airqo-stage-k8s-worker-2
