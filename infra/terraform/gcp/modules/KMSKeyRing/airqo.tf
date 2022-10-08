resource "google_kms_crypto_key" "airqo" {
  destroy_scheduled_duration = "86400s"
  key_ring                   = "projects/${var.project-id}/locations/eur3/keyRings/airqo-api"
  name                       = "airqo"
  purpose                    = "ENCRYPT_DECRYPT"
  rotation_period            = "7776000s"

  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "SOFTWARE"
  }
}
# terraform import google_kms_crypto_key.airqo projects/${var.project-id}/locations/eur3/keyRings/airqo-api/cryptoKeys/airqo
