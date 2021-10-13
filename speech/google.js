/* eslint-disable func-names */
const speech = require('@google-cloud/speech');
const path = require('path');

require('dotenv').config();

const { logger } = require('../utils/logger');
const { publisher } = require('../utils/redis');
const { REDIS_QUEUE_NAME, PROVIDER } = require('../constants');

const client = new speech.SpeechClient({
  keyFilename: path.join(__dirname, '../configs/credential_google.json'),
});

function GoogleSpeech({ sessionId, uuid, recognizeModel }) {
  this.sessionId = sessionId;
  this.uuid = uuid;
  this.isStopRecognize = false;
  this.lastText = 'Im lặng';
  this.provider = PROVIDER.GOOGLE;

  // variable
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 8000,
      languageCode: 'vi-VN',
    },
    interimResults: true,
    single_utterance: true,
    partial_results: true,
  };

  this.startRecognitionStream({ request });
}

GoogleSpeech.prototype.startRecognitionStream = function({ request }) {
  const me = this;
  this.recognizeStream = client
    .streamingRecognize(request)
    .on('error', err => {
      logger.error('[GoogleSpeech][Transcription] error: ', err);
      // stop recognize
    })
    .on('data', data => {
      logger.warn('[GoogleSpeech][Transcription] data: ', JSON.stringify(data));

      let transcript = '';
      let isFinal = true;
      if (data.error) {
        // error
        logger.error('[GoogleSpeech][Transcription] data.error: ', data.error);
      } else if (data.results) {
        isFinal = data.results[0].isFinal;
        transcript = data.results[0].alternatives[0].transcript.trim();
        logger.info(
          '[GoogleSpeech][Transcription]:',
          JSON.stringify({ transcript, isFinal }),
        );

        if (!transcript) {
          const words = data.results[0].alternatives[0].words || [];
          transcript = words.map(({ word }) => word).join(' ');
        }
        logger.warn('[GoogleSpeech][Transcription] transcript= ', transcript);
      }

      // send publish data
      publisher.publishAsync(
        REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT,
        JSON.stringify({
          sessionId: me.sessionId,
          uuid: me.uuid,
          isFinal,
          text: transcript,
          provider: me.provider,
        }),
      );
    })
    .on('end', function() {
      logger.info('[GoogleSpeech][Transcription] end');
      // stop recognize
      me.stopRecognitionStream();
    });
};

GoogleSpeech.prototype.stopRecognitionStream = function() {
  logger.info('[GoogleSpeech][stopRecognitionStream] stop recognition stream');
  this.isStopRecognize = true;
  if (this.recognizeStream) {
    this.recognizeStream.end();
  }
  this.recognizeStream = null;
};

GoogleSpeech.prototype.receiveByteData = function({ uuid, bytes }) {
  this.uuid = uuid;
  if (
    this.recognizeStream &&
    !this.recognizeStream.isPaused() &&
    !this.isStopRecognize
  ) {
    try {
      logger.info('[GoogleSpeech][receiveByteData] receive bytes data');
      this.recognizeStream.write(bytes);
    } catch (error) {
      logger.error('[GoogleSpeech][receiveByteData] error: ', error.message);

      this.stopRecognitionStream();
    }
  }
};

module.exports = { GoogleSpeech };
