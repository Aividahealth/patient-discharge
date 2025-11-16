/**
 * Service Level Objectives (SLOs)
 *
 * Defines SLOs and error budgets for patient-discharge system.
 */

# SLO 1: Availability - 99.5% of exports succeed
resource "google_monitoring_slo" "export_availability" {
  service      = google_monitoring_custom_service.patient_discharge.service_id
  slo_id       = "export-availability"
  display_name = "Export Availability - 99.5%"

  goal                = 0.995
  rolling_period_days = 30

  request_based_sli {
    good_total_ratio {
      total_service_filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/export/per_tenant\"",
        "resource.type=\"cloud_run_revision\""
      ])

      good_service_filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/export/per_tenant\"",
        "metric.label.status=\"success\"",
        "resource.type=\"cloud_run_revision\""
      ])
    }
  }
}

# SLO 2: Latency - 95% of exports complete within 60 seconds
resource "google_monitoring_slo" "export_latency_p95" {
  service      = google_monitoring_custom_service.patient_discharge.service_id
  slo_id       = "export-latency-p95"
  display_name = "Export Latency P95 < 60s"

  goal                = 0.95
  rolling_period_days = 30

  request_based_sli {
    distribution_cut {
      distribution_filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/export/duration\"",
        "resource.type=\"cloud_run_revision\""
      ])

      range {
        min = 0
        max = 60000 # 60 seconds in milliseconds
      }
    }
  }
}

# SLO 3: FHIR API Reliability - 99.9% success rate
resource "google_monitoring_slo" "fhir_api_reliability" {
  service      = google_monitoring_custom_service.patient_discharge.service_id
  slo_id       = "fhir-api-reliability"
  display_name = "FHIR API Reliability - 99.9%"

  goal                = 0.999
  rolling_period_days = 7

  request_based_sli {
    good_total_ratio {
      total_service_filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/fhir/requests\"",
        "resource.type=\"cloud_run_revision\""
      ])

      good_service_filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/fhir/requests\"",
        "metric.label.status=\"success\"",
        "resource.type=\"cloud_run_revision\""
      ])
    }
  }
}

# Custom Service Definition
resource "google_monitoring_custom_service" "patient_discharge" {
  service_id   = "patient-discharge-service"
  display_name = "Patient Discharge Export Service"

  telemetry {
    resource_name = "//cloudrun.googleapis.com/projects/${var.project_id}/locations/${var.region}/services/patient-discharge-backend"
  }
}

# Alerting on SLO Burn Rate
# Fast burn: 5% error budget consumed in 1 hour (page immediately)
resource "google_monitoring_alert_policy" "slo_fast_burn" {
  project      = var.project_id
  display_name = "SLO Fast Burn Rate Alert (P1)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Error budget burning at 14.4x rate (1 hour window)"

    condition_threshold {
      filter = join(" AND ", [
        "select_slo_burn_rate(\"${google_monitoring_slo.export_availability.id}\", 3600)"
      ])
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 14.4 # 5% budget in 1 hour = 14.4x normal rate

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **CRITICAL: Fast SLO Burn Rate**

      Error budget is being consumed at 14.4x normal rate. At this rate, entire monthly budget will be exhausted in 1 hour.

      **Immediate Actions:**
      1. Identify root cause (check dashboards and logs)
      2. Implement emergency mitigation
      3. Consider feature flag rollback if recent deployment

      **Error Budget Status:**
      - Check dashboard for remaining error budget percentage
      - Evaluate impact of continued burn rate
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_pagerduty
  ]
}

# Slow burn: 10% error budget consumed in 6 hours (email alert)
resource "google_monitoring_alert_policy" "slo_slow_burn" {
  project      = var.project_id
  display_name = "SLO Slow Burn Rate Alert (P2)"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Error budget burning at 2.4x rate (6 hour window)"

    condition_threshold {
      filter = join(" AND ", [
        "select_slo_burn_rate(\"${google_monitoring_slo.export_availability.id}\", 21600)"
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 2.4 # 10% budget in 6 hours = 2.4x normal rate

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **HIGH: Slow SLO Burn Rate**

      Error budget is being consumed at 2.4x normal rate. Investigate and plan remediation.

      **Actions:**
      1. Review recent changes and error patterns
      2. Plan investigation and fix
      3. Monitor burn rate trend
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_slack,
    var.notification_channel_email
  ]
}

# Outputs
output "slo_ids" {
  description = "Map of SLO names to IDs"
  value = {
    export_availability   = google_monitoring_slo.export_availability.id
    export_latency_p95    = google_monitoring_slo.export_latency_p95.id
    fhir_api_reliability  = google_monitoring_slo.fhir_api_reliability.id
  }
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}
