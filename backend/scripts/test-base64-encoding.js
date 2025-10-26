// Test script to verify base64 encoding logic
const testText = "# **Discharge Summary**\n\nPatient Name: [Redacted]\n\nMRN: [Redacted]";

console.log('=== Original Text ===');
console.log(testText);
console.log('\n=== Length ===');
console.log(`Original length: ${testText.length} characters`);

console.log('\n=== Base64 Encoding ===');
const base64Encoded = Buffer.from(testText, 'utf8').toString('base64');
console.log(`Base64: ${base64Encoded}`);
console.log(`Base64 length: ${base64Encoded.length} characters`);

console.log('\n=== Decoding Test ===');
const decoded = Buffer.from(base64Encoded, 'base64').toString('utf8');
console.log(`Decoded: ${decoded}`);
console.log(`Match original: ${decoded === testText}`);

console.log('\n=== FHIR Binary Resource ===');
const binaryResource = {
  resourceType: 'Binary',
  contentType: 'text/plain',
  data: base64Encoded,
  meta: {
    tag: [
      {
        system: 'http://aivida.com/fhir/tags',
        code: 'discharge-summary',
        display: 'Discharge Summary',
      }
    ]
  }
};

console.log('Binary Resource:');
console.log(JSON.stringify(binaryResource, null, 2));
