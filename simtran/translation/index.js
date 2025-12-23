// Entry point for Cloud Functions deployment
const { processSimplificationCompletedEvent } = require('./lib/pubsub-handler');

module.exports = {
  processSimplificationCompletedEvent
};
