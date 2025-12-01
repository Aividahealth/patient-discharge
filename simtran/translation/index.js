// Entry point for Cloud Functions deployment
const { translateDischargeSummary } = require('./lib/translation-function');

module.exports = {
  translateDischargeSummary
};
