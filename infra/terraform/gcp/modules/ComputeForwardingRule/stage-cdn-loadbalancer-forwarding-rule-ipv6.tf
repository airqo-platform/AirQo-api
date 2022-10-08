resource "google_compute_global_forwarding_rule" "stage_cdn_loadbalancer_forwarding_rule_ipv6" {
  ip_address            = "2600:1901:0:9194::"
  ip_protocol           = "TCP"
  ip_version            = "IPV6"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  name                  = "stage-cdn-loadbalancer-forwarding-rule-ipv6"
  port_range            = "80-80"
  project               = "${var.project-id}"
  target                = "https://www.googleapis.com/compute/beta/projects/airqo-250220/global/targetHttpProxies/stage-cdn-loadbalancer-target-proxy"
}
# terraform import google_compute_global_forwarding_rule.stage_cdn_loadbalancer_forwarding_rule_ipv6 projects/airqo-250220/global/forwardingRules/stage-cdn-loadbalancer-forwarding-rule-ipv6
