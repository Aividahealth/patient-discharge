#!/bin/bash

# Deploy Firestore Composite Indexes
# This script creates all necessary Firestore indexes for the patient discharge application

set -e  # Exit on error

PROJECT_ID="simtran-474018"

echo "🔥 Deploying Firestore Composite Indexes to Project: $PROJECT_ID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Function to create an index with error handling
create_index() {
    local collection=$1
    local fields=$2
    local description=$3

    echo "📋 Creating index: $description"
    echo "   Collection: $collection"

    if eval "$fields"; then
        echo "   ✅ Success"
    else
        echo "   ⚠️  Index may already exist or creation failed (continuing...)"
    fi
    echo ""
}

# Audit Logs Indexes
echo "📊 AUDIT_LOGS COLLECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_index "audit_logs" \
    "gcloud firestore indexes composite create \
        --collection-group=audit_logs \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=timestamp,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + timestamp DESC"

create_index "audit_logs" \
    "gcloud firestore indexes composite create \
        --collection-group=audit_logs \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=type,order=ascending \
        --field-config=field-path=timestamp,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + type + timestamp DESC"

create_index "audit_logs" \
    "gcloud firestore indexes composite create \
        --collection-group=audit_logs \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=userId,order=ascending \
        --field-config=field-path=timestamp,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + userId + timestamp DESC"

create_index "audit_logs" \
    "gcloud firestore indexes composite create \
        --collection-group=audit_logs \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=patientId,order=ascending \
        --field-config=field-path=timestamp,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + patientId + timestamp DESC"

# Discharge Summaries Indexes
echo "📄 DISCHARGE_SUMMARIES COLLECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_index "discharge_summaries" \
    "gcloud firestore indexes composite create \
        --collection-group=discharge_summaries \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=updatedAt,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + updatedAt DESC"

create_index "discharge_summaries" \
    "gcloud firestore indexes composite create \
        --collection-group=discharge_summaries \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=createdAt,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + createdAt DESC"

create_index "discharge_summaries" \
    "gcloud firestore indexes composite create \
        --collection-group=discharge_summaries \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=admissionDate,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + admissionDate DESC"

create_index "discharge_summaries" \
    "gcloud firestore indexes composite create \
        --collection-group=discharge_summaries \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=status,order=ascending \
        --field-config=field-path=updatedAt,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + status + updatedAt DESC"

create_index "discharge_summaries" \
    "gcloud firestore indexes composite create \
        --collection-group=discharge_summaries \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=patientId,order=ascending \
        --field-config=field-path=updatedAt,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + patientId + updatedAt DESC"

create_index "discharge_summaries" \
    "gcloud firestore indexes composite create \
        --collection-group=discharge_summaries \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=admissionDate,order=ascending \
        --field-config=field-path=updatedAt,order=descending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + admissionDate ASC + updatedAt DESC"

# Expert Feedback Indexes
echo "👨‍⚕️ EXPERT_FEEDBACK COLLECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
create_index "expert_feedback" \
    "gcloud firestore indexes composite create \
        --collection-group=expert_feedback \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=dischargeSummaryId,order=ascending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + dischargeSummaryId"

create_index "expert_feedback" \
    "gcloud firestore indexes composite create \
        --collection-group=expert_feedback \
        --query-scope=COLLECTION \
        --field-config=field-path=tenantId,order=ascending \
        --field-config=field-path=dischargeSummaryId,order=ascending \
        --field-config=field-path=reviewType,order=ascending \
        --project=$PROJECT_ID \
        --quiet" \
    "tenantId + dischargeSummaryId + reviewType"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Index creation commands completed!"
echo ""
echo "📝 Next Steps:"
echo "1. Check index build status:"
echo "   gcloud firestore indexes composite list --project=$PROJECT_ID"
echo ""
echo "2. Monitor in Firebase Console:"
echo "   https://console.firebase.google.com/project/$PROJECT_ID/firestore/indexes"
echo ""
echo "⏱️  Note: Large indexes may take several hours to build"
echo "   Your application will continue to work during index creation"
echo ""
