# Dev Monitoring Setup (GCP)

This directory contains scripts and configs to set up lightweight monitoring for the dev environment.

## Prerequisites

- gcloud CLI authenticated and configured
- IAM permissions to create log-based metrics, dashboards, and alerting policies
- Target project ID for dev

## Quick start

```bash
export PROJECT_ID=your-dev-project-id

# 1) Create log-based metrics
bash backend/scripts/monitoring/create-log-metrics.sh "$PROJECT_ID"

# 2) Create dashboards
bash backend/scripts/monitoring/create-dashboards.sh "$PROJECT_ID"

# 3) Create alerting policies
bash backend/scripts/monitoring/create-alerts.sh "$PROJECT_ID"
```

If any command fails due to permissions or API changes, the equivalent operations can be done in the GCP Console UI under Monitoring and Logging.


