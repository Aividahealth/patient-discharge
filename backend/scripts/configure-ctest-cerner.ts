/**
 * Script to configure ctest tenant with Cerner sandbox credentials
 * Uses the same configuration as the default/ec2458f2 tenant from config.yaml
 */

import { Firestore } from '@google-cloud/firestore';
import * as fs from 'fs';
import * as path from 'path';

function getFirestore(): Firestore {
  try {
    const serviceAccountPath = process.env.FIRESTORE_SERVICE_ACCOUNT_PATH || 
                               process.env.SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath) {
      const resolved = path.resolve(process.cwd(), serviceAccountPath);
      if (fs.existsSync(resolved)) {
        return new Firestore({ keyFilename: resolved });
      }
    }
    
    return new Firestore();
  } catch (error) {
    console.error('Failed to initialize Firestore:', error);
    throw error;
  }
}

async function configureCtestCerner() {
  console.log('🔧 Configuring ctest tenant with Cerner sandbox credentials...\n');

  try {
    const firestore = getFirestore();
    console.log('✅ Firestore client initialized\n');

    // Cerner sandbox configuration from config.yaml
    const cernerConfig = {
      base_url: "https://fhir-ehr-code.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d",
      patients: ["1", "12822233"],
      system_app: {
        client_id: "586c9547-92a4-49dd-8663-0ff3479c21fa",
        client_secret: "6Zxem8_cbX2ruxTPTmlBpdKAAoI78Bpb",
        token_url: "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token",
        scopes: "system/Account.read system/AllergyIntolerance.read system/AllergyIntolerance.write system/Appointment.read system/Appointment.write system/Basic.write system/Binary.read system/CarePlan.read system/CareTeam.read system/ChargeItem.read system/Communication.read system/Communication.write system/Condition.read system/Condition.write system/Consent.read system/Coverage.read system/Device.read system/DiagnosticReport.read system/DiagnosticReport.write system/DocumentReference.read system/DocumentReference.write system/Encounter.read system/Encounter.write system/FamilyMemberHistory.read system/FamilyMemberHistory.write system/FinancialTransaction.write system/Goal.read system/Immunization.read system/Immunization.write system/InsurancePlan.read system/Location.read system/Media.read system/MedicationAdministration.read system/MedicationDispense.read system/MedicationRequest.read system/MedicationRequest.write system/NutritionOrder.read system/Observation.read system/Observation.write system/Organization.read system/Organization.write system/Patient.read system/Patient.write system/Person.read system/Practitioner.read system/Practitioner.write system/Procedure.read system/Procedure.write system/Provenance.read system/Provenance.write system/Questionnaire.read system/QuestionnaireResponse.read system/QuestionnaireResponse.write system/RelatedPerson.read system/RelatedPerson.write system/Schedule.read system/ServiceRequest.read system/Slot.read system/Specimen.read"
      },
      provider_app: {
        client_id: "f6c307ef-be17-4496-9326-a9a6290187b9",
        client_secret: "", // Empty as per config.yaml
        authorization_url: "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/protocols/oauth2/profiles/smart-v1/personas/provider/authorize",
        token_url: "https://authorization.cerner.com/tenants/ec2458f2-1e24-41c8-b71b-0e701af7583d/hosts/fhir-ehr-code.cerner.com/protocols/oauth2/profiles/smart-v1/token",
        redirect_uri: "http://localhost:3000/auth/cerner/callback",
        scopes: "launch patient/Account.read patient/AllergyIntolerance.read patient/AllergyIntolerance.write patient/Appointment.read patient/Appointment.write patient/Basic.write patient/Binary.read patient/CarePlan.read patient/CareTeam.read patient/ChargeItem.read patient/Communication.read patient/Communication.write patient/Condition.read patient/Condition.write patient/Consent.read patient/Coverage.read patient/Device.read patient/DiagnosticReport.read patient/DiagnosticReport.write patient/DocumentReference.read patient/DocumentReference.write patient/Encounter.read patient/Encounter.write patient/FamilyMemberHistory.read patient/FamilyMemberHistory.write patient/FinancialTransaction.write patient/Goal.read patient/Immunization.read patient/Immunization.write patient/InsurancePlan.read patient/Location.read patient/Media.read patient/MedicationAdministration.read patient/MedicationDispense.read patient/MedicationRequest.read patient/MedicationRequest.write patient/NutritionOrder.read patient/Observation.read patient/Observation.write patient/Organization.read patient/Organization.write patient/Patient.read patient/Patient.write patient/Person.read patient/Practitioner.read patient/Practitioner.write patient/Procedure.read patient/Procedure.write patient/Provenance.read patient/Provenance.write patient/Questionnaire.read patient/QuestionnaireResponse.read patient/QuestionnaireResponse.write patient/RelatedPerson.read patient/RelatedPerson.write patient/Schedule.read patient/ServiceRequest.read patient/Slot.read patient/Specimen.read"
      }
    };

    // Get the ctest tenant document
    const docRef = firestore.collection('config').doc('ctest');
    const doc = await docRef.get();

    if (!doc.exists) {
      console.log('❌ ctest tenant not found in Firestore');
      return;
    }

    console.log('✅ Found ctest tenant in Firestore\n');

    // Update ehrIntegration with Cerner config
    await docRef.update({
      'ehrIntegration.cerner': cernerConfig,
      updatedAt: new Date(),
    });

    console.log('✅ Successfully configured ctest tenant with Cerner sandbox credentials');
    console.log('\n📋 Configuration Details:');
    console.log('   Base URL:', cernerConfig.base_url);
    console.log('   System App Client ID:', cernerConfig.system_app.client_id);
    console.log('   System App Token URL:', cernerConfig.system_app.token_url);
    console.log('   Test Patients:', cernerConfig.patients.join(', '));
    console.log('\n✅ Configuration complete!');

  } catch (error) {
    console.error('❌ Error configuring ctest tenant:', error);
    throw error;
  }
}

configureCtestCerner()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });

