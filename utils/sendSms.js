const SmsHistory = require('../models/SmsHistory');

module.exports = async (to, content) => {
  // Stub: Log to console, save history. Replace with Twilio in production.
  console.log(`SMS sent to ${to}: ${content}`);
  await new SmsHistory({ sentTo: to, content }).save();
};