resource "google_sql_database_instance" "pg_instance" {
  database_version = "MYSQL_5_7"
  name             = "pg-instance"
  project          = "airqo-250220"
  region           = "us-central1"

  settings {
    activation_policy = "NEVER"
    availability_type = "ZONAL"

    backup_configuration {
      backup_retention_settings {
        retained_backups = 7
        retention_unit   = "COUNT"
      }

      binary_log_enabled             = true
      enabled                        = true
      location                       = "us"
      start_time                     = "22:00"
      transaction_log_retention_days = 7
    }

    disk_autoresize       = true
    disk_autoresize_limit = 0
    disk_size             = 100
    disk_type             = "PD_SSD"

    ip_configuration {
      ipv4_enabled = true
    }

    location_preference {
      zone = "us-central1-a"
    }

    pricing_plan = "PER_USE"
    tier         = "db-n1-highmem-4"
  }
}
# terraform import google_sql_database_instance.pg_instance projects/airqo-250220/instances/pg-instance
