const { VaisSpeech } = require('./vais');
const { VbeeSpeech } = require('./vbee');
const { GoogleSpeech } = require('./google');
const { LabSpeech } = require('./lab');

const { PROVIDER } = require('../constants');
// test stt vbee
const ServiceSpeech = provider => params => {
  switch (provider) {
    case PROVIDER.VBEE:
      return new VbeeSpeech(params);
    case PROVIDER.VAIS:
      return new VaisSpeech(params);
    case PROVIDER.LAB:
      return new LabSpeech(params);
    default:
      return new GoogleSpeech(params);
  }
};

module.exports = { ServiceSpeech };
