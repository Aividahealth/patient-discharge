/**
 * Script to publish encounter export event with correct composition from ctest FHIR store
 */

import { PubSub } from '@google-cloud/pubsub';

const TOPIC_NAME = 'discharge-export-events';
const PROJECT_ID = 'simtran-474018';

async function publishEvent() {
  console.log('🚀 Publishing encounter export event with CORRECT composition');
  console.log('='.repeat(80));

  try {
    const pubsub = new PubSub({ projectId: PROJECT_ID });
    const topic = pubsub.topic(TOPIC_NAME);

    // Composition da180b84-3e5b-4f3f-be2f-c5c8b5baf750 is in ctest-fhir-store
    const event = {
      eventType: 'encounter.exported',
      timestamp: new Date().toISOString(),
      data: {
        tenantId: 'ctest',
        patientId: '1',
        exportTimestamp: new Date().toISOString(),
        status: 'success',
        cernerEncounterId: '97958672',
        googleEncounterId: 'ee6532f3-ee65-443a-8c97-068a9191d30c',
        googleCompositionId: 'da180b84-3e5b-4f3f-be2f-c5c8b5baf750',
      },
    };

    console.log('📤 Publishing event:');
    console.log('   Tenant: ctest');
    console.log('   Patient: 1');
    console.log('   Composition: da180b84-3e5b-4f3f-be2f-c5c8b5baf750');
    console.log('   FHIR Store: ctest-dataset/ctest-fhir-store');
    console.log();

    const messageId = await topic.publishMessage({
      data: Buffer.from(JSON.stringify(event)),
      attributes: {
        eventType: 'encounter.exported',
        tenantId: 'ctest',
        patientId: '1',
        status: 'success',
      },
    });

    console.log('✅ Message published successfully!');
    console.log(`   Message ID: ${messageId}`);
    console.log('\n📝 This should trigger the full pipeline:');
    console.log('   1. discharge-export-processor fetches from ctest FHIR store');
    console.log('   2. Writes discharge summary to GCS bucket discharge-summaries-raw-ctest');
    console.log('   3. discharge-summary-simplifier simplifies the content');
    console.log('   4. discharge-summary-translator translates to Spanish');
    console.log('\n💡 Monitor with:');
    console.log('   gcloud functions logs read discharge-export-processor --limit=30');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

publishEvent();
