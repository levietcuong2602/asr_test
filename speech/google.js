/* eslint-disable func-names */
const speech = require('@google-cloud/speech');
const path = require('path');
const streamifier = require('streamifier');

require('dotenv').config();

const { logger } = require('../utils/logger');
const { publisher } = require('../utils/redis');
const { REDIS_QUEUE_NAME } = require('../constants');

const client = new speech.SpeechClient({
  keyFilename: path.join(__dirname, '../configs/credential_google.json'),
});

function GoogleSpeech({ sessionId, uuid, recognizeModel }) {
  this.sessionId = sessionId;
  this.uuid = uuid;
  this.isStopRecognize = false;
  this.lastText = 'Im lặng';

  // variable
  const request = {
    config: {
      encoding: 'LINEAR16',
      sampleRateHertz: 8000,
      languageCode: 'vi-VN',
    },
    interimResults: false,
  };

  this.startRecognitionStream({ request });
}

GoogleSpeech.prototype.startRecognitionStream = function({ request }) {
  this.recognizeStream = client
    .streamingRecognize(request)
    .on('error', err => {
      logger.error('[GoogleSpeech][Transcription] error: ', err);
      // stop recognize
    })
    .on('data', data => {
      logger.warn('[GoogleSpeech][Transcription] data: ', JSON.stringify(data));
      if (data.error) {
        // error
        logger.error('[GoogleSpeech][Transcription] data.error: ', data.error);
      } else if (data.results) {
        logger.warn(
          '[GoogleSpeech][Transcription]data.results: ',
          JSON.stringify(data.results),
        );
      }
    })
    .on('end', function() {
      logger.info('[GoogleSpeech][Transcription] end');
      // stop recognize
    });
};

GoogleSpeech.prototype.stopRecognitionStream = function() {
  logger.info('[GoogleSpeech][stopRecognitionStream] stop recognition stream');
  this.isStopRecognize = true;
  if (this.recognizeStream) {
    this.recognizeStream.end();
  }
  this.recognizeStream = null;

  setTimeout(() => {
    logger.info(
      this.sessionId,
      `[GoogleSpeech][stopRecognitionStream] auto close timeout`,
    );
    // send publish data
    publisher.publishAsync(
      REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT,
      JSON.stringify({
        sessionId: this.sessionId,
        uuid: this.uuid,
        isFinal: true,
        text: this.lastText,
      }),
    );
  }, 2 * 1000);
};

GoogleSpeech.prototype.receiveByteData = function({ uuid, bytes }) {
  this.uuid = uuid;
  if (this.recognizeStream && !this.isStopRecognize) {
    try {
      logger.info('[GoogleSpeech][receiveByteData] receive bytes data');
      this.recognizeStream.write(bytes);
    } catch (error) {
      logger.error(
        '[GoogleSpeech][receiveByteData] receive bytes data error: ',
        error.message,
      );

      this.stopRecognitionStream();
    }
  } else {
    logger.error('[GoogleSpeech][receiveByteData] stream closed');
  }
};

module.exports = { GoogleSpeech };
