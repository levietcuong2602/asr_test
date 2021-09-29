const { VaisSpeech } = require('./vais');
const { VbeeSpeech } = require('./vbee');
const { GoogleSpeech } = require('./google');

const { PROVIDER } = require('../constants');
// test stt vbee
const ServiceSpeech = provider => params => {
  return new GoogleSpeech(params);
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
