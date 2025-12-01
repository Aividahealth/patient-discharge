#!/bin/bash

# EPIC Integration Setup Script
# Generates RSA key pairs for EPIC sandbox integration

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}EPIC Sandbox Integration Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Determine environment
read -p "Environment (dev/prod) [dev]: " ENV
ENV=${ENV:-dev}

SETTINGS_DIR=".settings.$ENV"

# Create settings directory if it doesn't exist
if [ ! -d "$SETTINGS_DIR" ]; then
    echo -e "${YELLOW}Creating $SETTINGS_DIR directory...${NC}"
    mkdir -p "$SETTINGS_DIR"
fi

echo -e "${GREEN}Using settings directory: $SETTINGS_DIR${NC}"
echo ""

# Generate System-to-System App Keys
echo -e "${BLUE}Step 1: Generate System-to-System App Keys${NC}"
echo "-------------------------------------------"

SYSTEM_PRIVATE_KEY="$SETTINGS_DIR/epic-system-private-key.pem"
SYSTEM_PUBLIC_KEY="$SETTINGS_DIR/epic-system-public-key.pem"

if [ -f "$SYSTEM_PRIVATE_KEY" ]; then
    read -p "System private key already exists. Overwrite? (y/N): " OVERWRITE
    if [ "$OVERWRITE" != "y" ]; then
        echo -e "${YELLOW}Skipping system key generation${NC}"
    else
        echo -e "${GREEN}Generating new system keys...${NC}"
        openssl genrsa -out "$SYSTEM_PRIVATE_KEY" 4096
        openssl rsa -in "$SYSTEM_PRIVATE_KEY" -pubout -out "$SYSTEM_PUBLIC_KEY"
        chmod 600 "$SYSTEM_PRIVATE_KEY"
        chmod 644 "$SYSTEM_PUBLIC_KEY"
        echo -e "${GREEN}✓ System keys generated${NC}"
    fi
else
    echo -e "${GREEN}Generating system keys...${NC}"
    openssl genrsa -out "$SYSTEM_PRIVATE_KEY" 4096
    openssl rsa -in "$SYSTEM_PRIVATE_KEY" -pubout -out "$SYSTEM_PUBLIC_KEY"
    chmod 600 "$SYSTEM_PRIVATE_KEY"
    chmod 644 "$SYSTEM_PUBLIC_KEY"
    echo -e "${GREEN}✓ System keys generated${NC}"
fi

echo ""

# Generate Provider App Keys (optional)
echo -e "${BLUE}Step 2: Generate Provider (Clinician-Facing) App Keys (Optional)${NC}"
echo "-------------------------------------------------------------------"
read -p "Generate separate keys for provider app? (y/N): " GEN_PROVIDER
echo ""

if [ "$GEN_PROVIDER" = "y" ]; then
    PROVIDER_PRIVATE_KEY="$SETTINGS_DIR/epic-provider-private-key.pem"
    PROVIDER_PUBLIC_KEY="$SETTINGS_DIR/epic-provider-public-key.pem"

    if [ -f "$PROVIDER_PRIVATE_KEY" ]; then
        read -p "Provider private key already exists. Overwrite? (y/N): " OVERWRITE
        if [ "$OVERWRITE" != "y" ]; then
            echo -e "${YELLOW}Skipping provider key generation${NC}"
        else
            echo -e "${GREEN}Generating new provider keys...${NC}"
            openssl genrsa -out "$PROVIDER_PRIVATE_KEY" 4096
            openssl rsa -in "$PROVIDER_PRIVATE_KEY" -pubout -out "$PROVIDER_PUBLIC_KEY"
            chmod 600 "$PROVIDER_PRIVATE_KEY"
            chmod 644 "$PROVIDER_PUBLIC_KEY"
            echo -e "${GREEN}✓ Provider keys generated${NC}"
        fi
    else
        echo -e "${GREEN}Generating provider keys...${NC}"
        openssl genrsa -out "$PROVIDER_PRIVATE_KEY" 4096
        openssl rsa -in "$PROVIDER_PRIVATE_KEY" -pubout -out "$PROVIDER_PUBLIC_KEY"
        chmod 600 "$PROVIDER_PRIVATE_KEY"
        chmod 644 "$PROVIDER_PUBLIC_KEY"
        echo -e "${GREEN}✓ Provider keys generated${NC}"
    fi
fi

echo ""
echo -e "${BLUE}Step 3: Configuration${NC}"
echo "----------------------"

# Get tenant ID
read -p "Enter your tenant ID [hospital-epic]: " TENANT_ID
TENANT_ID=${TENANT_ID:-hospital-epic}

# Get client IDs from EPIC
echo ""
echo -e "${YELLOW}You'll need to get these values from EPIC App Orchard:${NC}"
echo "1. Go to https://fhir.epic.com/"
echo "2. Open your System-to-System app"
echo "3. Find your Client ID"
echo ""
read -p "Enter EPIC System App Client ID: " SYSTEM_CLIENT_ID

if [ "$GEN_PROVIDER" = "y" ]; then
    read -p "Enter EPIC Provider App Client ID: " PROVIDER_CLIENT_ID
fi

# Generate key IDs
SYSTEM_KEY_ID="epic-system-key-$(date +%s)"
PROVIDER_KEY_ID="epic-provider-key-$(date +%s)"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Summary
echo -e "${BLUE}Generated Files:${NC}"
echo "  Private Key: $SYSTEM_PRIVATE_KEY"
echo "  Public Key:  $SYSTEM_PUBLIC_KEY"
if [ "$GEN_PROVIDER" = "y" ]; then
    echo "  Provider Private Key: $PROVIDER_PRIVATE_KEY"
    echo "  Provider Public Key:  $PROVIDER_PUBLIC_KEY"
fi
echo ""

# Configuration snippet
echo -e "${BLUE}Add this to your $SETTINGS_DIR/config.yaml:${NC}"
echo ""
echo "---"
cat << EOF
tenants:
  $TENANT_ID:
    ehr:
      vendor: epic
      base_url: "https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"

      system_app:
        client_id: "$SYSTEM_CLIENT_ID"
        private_key_path: "$SYSTEM_PRIVATE_KEY"
        key_id: "$SYSTEM_KEY_ID"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        scopes: "system/Patient.read system/DocumentReference.read system/Binary.read system/Observation.read"
EOF

if [ "$GEN_PROVIDER" = "y" ]; then
cat << EOF

      provider_app:
        client_id: "$PROVIDER_CLIENT_ID"
        private_key_path: "$PROVIDER_PRIVATE_KEY"
        key_id: "$PROVIDER_KEY_ID"
        authorization_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize"
        token_url: "https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token"
        redirect_uri: "https://your-domain.com/auth/epic/callback"
        scopes: "launch/patient patient/Patient.read patient/DocumentReference.read"
EOF
fi
echo "---"
echo ""

# JWK Set URL instructions
echo -e "${BLUE}Configure EPIC App Orchard:${NC}"
echo ""
echo "1. Deploy your backend to a publicly accessible HTTPS URL"
echo "2. In EPIC App Orchard, set the JWK Set URLs to:"
echo ""
echo -e "   ${GREEN}Non-Production JWK Set URL:${NC}"
echo "   https://your-domain.com/.well-known/jwks/$TENANT_ID"
echo ""
echo -e "   ${GREEN}Production JWK Set URL:${NC}"
echo "   https://your-domain.com/.well-known/jwks/$TENANT_ID"
echo ""

if [ "$GEN_PROVIDER" = "y" ]; then
    echo -e "   ${GREEN}Provider App JWK Set URL (if different):${NC}"
    echo "   https://your-domain.com/.well-known/jwks/$TENANT_ID/provider"
    echo ""
fi

# Next steps
echo -e "${BLUE}Next Steps:${NC}"
echo ""
echo "1. Update your config.yaml with the configuration above"
echo "2. Deploy your backend to a publicly accessible domain"
echo "3. Configure JWK Set URLs in EPIC App Orchard"
echo "4. Test the integration with:"
echo "   curl https://your-domain.com/.well-known/jwks/$TENANT_ID"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Never commit private keys to version control!${NC}"
echo -e "${YELLOW}⚠️  Ensure $SETTINGS_DIR/*.pem is in your .gitignore${NC}"
echo ""

# Check .gitignore
if ! grep -q "\.pem" .gitignore 2>/dev/null; then
    echo -e "${RED}WARNING: .pem files not found in .gitignore!${NC}"
    read -p "Add *.pem to .gitignore? (Y/n): " ADD_GITIGNORE
    ADD_GITIGNORE=${ADD_GITIGNORE:-y}
    if [ "$ADD_GITIGNORE" = "y" ]; then
        echo "*.pem" >> .gitignore
        echo -e "${GREEN}✓ Added *.pem to .gitignore${NC}"
    fi
fi

echo ""
echo -e "${GREEN}For detailed setup instructions, see:${NC}"
echo "  backend/docs/EPIC_SANDBOX_SETUP.md"
echo ""
