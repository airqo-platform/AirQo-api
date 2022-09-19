resource "google_compute_instance" "airqo_k8s_worker_3" {
  boot_disk {
    auto_delete = true
    device_name = "persistent-disk-0"

    initialize_params {
      image = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1804-bionic-v20200916"
      size  = 200
      type  = "pd-standard"
    }

    mode   = "READ_WRITE"
    source = "https://www.googleapis.com/compute/v1/projects/airqo-250220/zones/europe-west1-b/disks/airqo-k8s-worker-3"
  }

  can_ip_forward = true

  confidential_instance_config {
    enable_confidential_compute = false
  }

  machine_type = "e2-custom-2-5376"

  metadata = {
    ssh-keys = "mikemwanje:ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBPogwecrfowgrr0gghuAXi+tdrnqNl41y1R3iMBZSMBHpJSiZmW/bOEf3Kd1sAJ2l+cWJ/0p3PoiljTPyQcsgbw= google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-04T06:16:13+0000\"}\nmikemwanje:ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQCA7CB7MnWB9e4MQQmFYkiEhJIH0Ot0xyIAyAGymPnSD5VhobjFu/NR1kfXUMERAeXREQO6avkKsssRPOCdjsIOTscIiTs7/H6um8/gJCK2fD175mZHdjtHvW30/eBRxrb8j5oVU55IpLneLbU1tT3HKyTaGwrnTx3Hr3og214xOer8auszY8IzHb0/LbNLBVckbw5F484k5hLFD2+R3HVRbMRNYmkSCNdrDg/oS9G/cjpMygjyyWcczqpy+d5BBoNqQBobam0ErIjqHM1FcN2tgoDC/VFVfZ1fLO+j0QaYkw9P/fTaOuM381oqQ/UHSMBOrmy+0HyMeZDObsVfgqC3 google-ssh {\"userName\":\"mikemwanje@airqo.net\",\"expireOn\":\"2022-09-04T06:16:28+0000\"}"
  }

  name = "airqo-k8s-worker-3"

  network_interface {
    access_config {
      nat_ip       = "34.78.161.128"
      network_tier = "PREMIUM"
    }

    network            = "https://www.googleapis.com/compute/v1/projects/airqo-250220/global/networks/airqo-k8s-cluster"
    network_ip         = "10.240.0.67"
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

  tags = ["airqo-k8s", "worker"]
  zone = "europe-west1-b"
}
# terraform import google_compute_instance.airqo_k8s_worker_3 projects/airqo-250220/zones/europe-west1-b/instances/airqo-k8s-worker-3
