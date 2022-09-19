resource "google_dns_managed_zone" "platform_airqo_net" {
  dns_name      = "airqo.net."
  force_destroy = false
  name          = "platform-airqo-net"
  project       = "airqo-frontend"
  visibility    = "public"
}
# terraform import google_dns_managed_zone.platform_airqo_net projects/airqo-frontend/managedZones/platform-airqo-net
