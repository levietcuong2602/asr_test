const { VaisSpeech } = require('./vais');
const { VbeeSpeech } = require('./vbee');
const { PROVIDER } = require('../constants');
// test stt vbee
const ServiceSpeech = provider => params => {
  switch (provider) {
    case PROVIDER.VBEE:
      return new VbeeSpeech(params);
    case PROVIDER.VAIS:
      return new VaisSpeech(params);
    default:
      return null;
  }
};

module.exports = { ServiceSpeech };
