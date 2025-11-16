/**
 * Google Cloud Monitoring Alert Policies
 *
 * Defines alerting policies for patient-discharge system.
 * Deploy with: terraform apply
 */

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "notification_channel_pagerduty" {
  description = "Notification channel ID for PagerDuty"
  type        = string
}

variable "notification_channel_slack" {
  description = "Notification channel ID for Slack"
  type        = string
}

variable "notification_channel_email" {
  description = "Notification channel ID for Email"
  type        = string
}

# ALERT-001: SLO Error Budget Exhausted (P1 - Critical)
resource "google_monitoring_alert_policy" "slo_error_budget_exhausted" {
  project      = var.project_id
  display_name = "ALERT-001: SLO Error Budget Exhausted"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Error budget remaining < 10%"

    condition_threshold {
      filter          = "metric.type=\"custom.googleapis.com/discharge/export/success_rate\" resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison      = "COMPARISON_LT"
      threshold_value = 99.0

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **CRITICAL: Error budget is exhausted**

      The success rate has fallen below 99%, consuming 10% or more of our error budget.

      **Runbook:** https://docs.example.com/runbooks/slo-breach.md

      **Immediate Actions:**
      1. Check Error Reporting for top error types
      2. Verify FHIR API status
      3. Review recent deployments (rollback if needed)
      4. Check Gemini API quotas

      **Error Budget Policy:**
      - Freeze non-critical feature releases
      - Focus engineering resources on reliability
      - Conduct incident review within 24h
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_pagerduty,
    var.notification_channel_slack
  ]

  alert_strategy {
    auto_close = "1800s"
  }
}

# ALERT-002: Pub/Sub Dead Letter Queue Buildup (P1 - Critical)
resource "google_monitoring_alert_policy" "pubsub_dlq_buildup" {
  project      = var.project_id
  display_name = "ALERT-002: Pub/Sub Dead Letter Queue Buildup"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Dead letter message count > 10"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"pubsub_subscription\"",
        "metric.type=\"pubsub.googleapis.com/subscription/num_undelivered_messages\"",
        "resource.label.subscription_id=monitoring.regex.full_match(\".*-dead-letter$\")"
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 10

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **CRITICAL: Dead Letter Queue Buildup**

      More than 10 messages have accumulated in the dead letter queue, indicating systematic processing failures.

      **Runbook:** https://docs.example.com/runbooks/pubsub-dlq.md

      **Immediate Actions:**
      1. Inspect DLQ messages for error patterns
      2. Check Cloud Function logs for failures
      3. Identify common failure modes:
         - Invalid message format
         - FHIR API errors
         - Gemini API quota exceeded
         - Missing tenant configuration
      4. Fix root cause
      5. Manually replay or discard messages

      **DLQ Inspection:**
      ```bash
      gcloud pubsub subscriptions pull SUBSCRIPTION-dead-letter --limit=10
      ```
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_pagerduty,
    var.notification_channel_slack
  ]

  alert_strategy {
    auto_close = "3600s"
  }
}

# ALERT-003: FHIR API Complete Failure (P1 - Critical)
resource "google_monitoring_alert_policy" "fhir_api_failure" {
  project      = var.project_id
  display_name = "ALERT-003: FHIR API Complete Failure"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "FHIR error rate > 50%"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/fhir/errors\"",
        "resource.type=\"cloud_run_revision\""
      ])
      duration        = "120s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.5

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **CRITICAL: FHIR API Complete Failure**

      More than 50% of FHIR API requests are failing. This is likely a systemic outage.

      **Runbook:** https://docs.example.com/runbooks/fhir-outage.md

      **Immediate Actions:**
      1. Check Google Cloud Healthcare API status: https://status.cloud.google.com/
      2. Verify service account permissions (IAM roles)
      3. Check FHIR store existence and configuration
      4. Review recent infrastructure changes
      5. Contact Google Cloud Support (Premium Support ticket)

      **Escalation:**
      - Page on-call infrastructure lead
      - Open P1 ticket with Google Cloud Support
      - Notify stakeholders of outage
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_pagerduty,
    var.notification_channel_slack,
    var.notification_channel_email
  ]

  alert_strategy {
    auto_close = "1800s"

    notification_rate_limit {
      period = "300s"
    }
  }
}

# ALERT-004: Gemini API Quota Approaching Limit (P2 - High)
resource "google_monitoring_alert_policy" "gemini_quota_limit" {
  project      = var.project_id
  display_name = "ALERT-004: Gemini API Quota Approaching Limit"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Gemini tokens used > 80% of daily quota"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/gemini/tokens\"",
        "resource.type=\"cloud_run_revision\""
      ])
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 8000000 # 80% of 10M daily quota (adjust to your quota)

      aggregations {
        alignment_period     = "3600s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **HIGH: Gemini API Quota Approaching Limit**

      Token usage is approaching daily quota limit. Service degradation imminent.

      **Runbook:** https://docs.example.com/runbooks/gemini-quota.md

      **Immediate Actions:**
      1. Review token usage by tenant (identify heavy users)
      2. Throttle non-critical tenants temporarily
      3. Request quota increase from Google Cloud Console:
         - Navigate to: IAM & Admin → Quotas
         - Filter: Vertex AI API - Tokens per day
         - Request increase
      4. Optimize prompts to reduce token usage

      **Long-term:**
      - Implement tenant-level rate limiting
      - Add token budget alerts per tenant
      - Consider prompt engineering optimization
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_slack,
    var.notification_channel_email
  ]

  alert_strategy {
    auto_close = "7200s"
  }
}

# ALERT-005: Cloud Function Timeout Rate High (P2 - High)
resource "google_monitoring_alert_policy" "function_timeout_rate" {
  project      = var.project_id
  display_name = "ALERT-005: Cloud Function Timeout Rate High"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Function timeout rate > 5%"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"cloud_function\"",
        "metric.type=\"cloudfunctions.googleapis.com/function/execution_count\"",
        "metric.label.status=\"timeout\""
      ])
      duration        = "600s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_MEAN"
        group_by_fields      = ["resource.label.function_name"]
      }
    }
  }

  documentation {
    content   = <<-EOT
      **HIGH: Cloud Function Timeout Rate Elevated**

      More than 5% of function invocations are timing out.

      **Runbook:** https://docs.example.com/runbooks/function-timeouts.md

      **Investigation Steps:**
      1. Check Cloud Trace for slow spans (identify bottleneck)
      2. Review Gemini API latency (most common cause)
      3. Check FHIR API query performance
      4. Verify function timeout configuration (current: 540s)

      **Common Causes:**
      - Gemini API slow response (check Vertex AI status)
      - Large document processing (>20 pages)
      - FHIR API rate limiting (check for 429 errors)
      - Cold start amplification

      **Mitigation:**
      - Increase function timeout if justified
      - Implement document size limits
      - Add request timeouts to external API calls
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_slack
  ]

  alert_strategy {
    auto_close = "3600s"
  }
}

# ALERT-006: Processing Latency SLO Violation (P2 - High)
resource "google_monitoring_alert_policy" "latency_slo_violation" {
  project      = var.project_id
  display_name = "ALERT-006: Processing Latency SLO Violation"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "P95 processing time > 90s"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/export/duration\"",
        "resource.type=\"cloud_run_revision\""
      ])
      duration        = "900s"
      comparison      = "COMPARISON_GT"
      threshold_value = 90000 # 90 seconds in milliseconds

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_DELTA"
        cross_series_reducer = "REDUCE_PERCENTILE_95"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **HIGH: Processing Latency SLO Violation**

      95th percentile processing time exceeds 90 seconds (approaching 120s SLO).

      **Runbook:** https://docs.example.com/runbooks/high-latency.md

      **Investigation:**
      1. Check Cloud Trace for slow spans
      2. Identify bottleneck stage (export, simplification, translation)
      3. Review Gemini API performance metrics
      4. Check concurrent processing limits

      **Performance Breakdown:**
      - Expected: Export (2s) + Simplification (30s) + Translation (8s) = 40s
      - Current: Check dashboard for actual breakdown

      **Optimization Options:**
      - Increase Cloud Function concurrency
      - Optimize Gemini prompts (reduce tokens)
      - Parallel processing for multi-language translation
      - Caching for repeated content
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_slack
  ]

  alert_strategy {
    auto_close = "3600s"
  }
}

# ALERT-007: Elevated Error Rate (P3 - Medium)
resource "google_monitoring_alert_policy" "elevated_error_rate" {
  project      = var.project_id
  display_name = "ALERT-007: Elevated Error Rate"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Error rate > 2% AND < 5%"

    condition_threshold {
      filter = join(" AND ", [
        "metric.type=\"custom.googleapis.com/discharge/export/per_tenant\"",
        "metric.label.status=\"error\"",
        "resource.type=\"cloud_run_revision\""
      ])
      duration        = "1800s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.02

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_RATE"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **MEDIUM: Elevated Error Rate**

      Error rate is above normal (2-5%) but not critical. Monitor for trend.

      **Runbook:** https://docs.example.com/runbooks/elevated-errors.md

      **Actions:**
      1. Monitor error trend (increasing vs. stable)
      2. Review error types in Error Reporting
      3. Check for tenant-specific issues
      4. Plan investigation during business hours (if stable)

      **Common Causes:**
      - Transient FHIR API errors (retry-able)
      - Invalid document formats from specific tenants
      - Configuration issues (new tenants)

      **Escalation:**
      - If error rate reaches 5%, escalates to ALERT-001
      - If trend increasing, investigate immediately
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_email
  ]

  alert_strategy {
    auto_close = "7200s"
  }
}

# ALERT-008: GCS Storage Cost Anomaly (P3 - Medium)
resource "google_monitoring_alert_policy" "storage_cost_anomaly" {
  project      = var.project_id
  display_name = "ALERT-008: GCS Storage Cost Anomaly"
  combiner     = "OR"
  enabled      = true

  conditions {
    display_name = "Daily storage cost > 150% of 7-day average"

    condition_threshold {
      filter = join(" AND ", [
        "resource.type=\"gcs_bucket\"",
        "metric.type=\"storage.googleapis.com/storage/total_bytes\""
      ])
      duration        = "21600s" # 6 hours
      comparison      = "COMPARISON_GT"
      threshold_value = 107374182400 # 100 GB (adjust based on your baseline)

      aggregations {
        alignment_period     = "3600s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_SUM"
      }
    }
  }

  documentation {
    content   = <<-EOT
      **MEDIUM: GCS Storage Cost Anomaly**

      Storage usage is significantly higher than normal. Investigate potential issues.

      **Runbook:** https://docs.example.com/runbooks/cost-anomaly.md

      **Investigation:**
      1. Check for unusual export volume (specific tenant)
      2. Verify bucket lifecycle policies are active
      3. Audit tenant activity for anomalies
      4. Check for failed deletion jobs

      **Lifecycle Policy:**
      - Raw files: Delete after 90 days
      - Simplified files: Delete after 180 days
      - Translated files: Delete after 180 days

      **Cost Optimization:**
      - Enable Coldline storage for files > 30 days old
      - Implement tenant storage quotas
      - Archive infrequently accessed files
    EOT
    mime_type = "text/markdown"
  }

  notification_channels = [
    var.notification_channel_email
  ]

  alert_strategy {
    auto_close = "86400s" # 24 hours
  }
}

# Outputs
output "alert_policy_ids" {
  description = "Map of alert policy names to IDs"
  value = {
    slo_error_budget_exhausted = google_monitoring_alert_policy.slo_error_budget_exhausted.id
    pubsub_dlq_buildup         = google_monitoring_alert_policy.pubsub_dlq_buildup.id
    fhir_api_failure           = google_monitoring_alert_policy.fhir_api_failure.id
    gemini_quota_limit         = google_monitoring_alert_policy.gemini_quota_limit.id
    function_timeout_rate      = google_monitoring_alert_policy.function_timeout_rate.id
    latency_slo_violation      = google_monitoring_alert_policy.latency_slo_violation.id
    elevated_error_rate        = google_monitoring_alert_policy.elevated_error_rate.id
    storage_cost_anomaly       = google_monitoring_alert_policy.storage_cost_anomaly.id
  }
}
