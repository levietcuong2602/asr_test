const { VaisSpeech } = require('./vais');
const { VbeeSpeech } = require('./vbee');
const { PROVIDER } = require('../constants');
// test stt vbee
const ServiceSpeech = provider => {
  switch (provider) {
    case PROVIDER.VBEE:
      return new VbeeSpeech();
    case PROVIDER.VAIS:
      return new VaisSpeech();
    default:
      return null;
  }
};

module.exports = { ServiceSpeech };
