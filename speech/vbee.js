/* eslint-disable func-names */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const _ = require('lodash');

require('dotenv').config();
const { logger } = require('../utils/logger');
const { publisher } = require('../utils/redis');
const { REDIS_QUEUE_NAME, PROVIDER } = require('../constants');

const API_KEY_DEFAULT = '6FV9YwvcaSugKq6k';

const PROTO_PATH = path.join(__dirname, '../lib/stt_vbee_service.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const speech = grpc.loadPackageDefinition(packageDefinition).vbee.stt.v1;

function VbeeSpeech({ sessionId, uuid, recognizeModel, apiKey }) {
  this.sessionId = sessionId;
  this.uuid = uuid;
  this.lastText = 'Im lặng';
  this.provider = PROVIDER.VBEE;
  this.recognizeModel = recognizeModel;

  // variable
  const request = {
    config: {
      specification: {
        model: 'Wav2vec2',
        record: false,
        partial_results: true,
        single_utterance: true,
        interim_results: false,
        config_audio: {
          encoding: 1,
          max_alternatives: 1,
          session_id: uuid,
          sample_rate_hertz: 8000,
        },
      },
    },
  };
  this.startRecognitionStream({ request, apiKey: apiKey || API_KEY_DEFAULT });
}

VbeeSpeech.prototype.startRecognitionStream = function({
  request,
  apiKey = API_KEY_DEFAULT,
}) {
  const endpoint = '0.tcp.ngrok.io:16055';
  logger.info('endpoint', endpoint);

  const client = new speech.SttService(
    endpoint,
    grpc.credentials.createInsecure(),
  );
  logger.info('apiKey', apiKey || API_KEY_DEFAULT);
  const meta = new grpc.Metadata();
  meta.add('api-key', apiKey);

  const me = this;
  this.recognizeStream = client
    .StreamingRecognize(meta)
    .on('data', function(data) {
      logger.warn('[VbeeSpeech][Transcription] data: ', JSON.stringify(data));
      const { text, is_final: final } = data;
      // send publish data
      publisher.publishAsync(
        REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT,
        JSON.stringify({
          sessionId: me.sessionId,
          uuid: me.uuid,
          isFinal: final,
          text,
          provider: me.provider,
        }),
      );
    })
    .on('error', function(err) {
      logger.error('[VbeeSpeech][Transcription] error: ', err);
    })
    .on('end', function() {
      logger.info('[VbeeSpeech][Transcription] end');
      // send publish data
      publisher.publishAsync(
        REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT,
        JSON.stringify({
          sessionId: me.sessionId,
          uuid: me.uuid,
          isFinal: true,
          text: me.lastText,
          provider: me.provider,
        }),
      );
    });

  this.recognizeStream.write(request);
};

VbeeSpeech.prototype.stopRecognitionStream = function(reson) {
  logger.info(
    '[VbeeSpeech][stopRecognitionStream] stop recognition stream: ',
    this.uuid,
    reson,
  );
  this.isStopRecognize = true;
  if (this.recognizeStream) {
    this.recognizeStream.end();
  }
  this.recognizeStream = null;

  setTimeout(() => {
    logger.info(
      this.sessionId,
      `[VbeeSpeech][stopRecognitionStream] auto close timeout ${this.uuid}`,
    );
    // send publish data
    publisher.publishAsync(
      REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT,
      JSON.stringify({
        sessionId: this.sessionId,
        uuid: this.uuid,
        isFinal: true,
        text: this.lastText,
        provider: this.provider,
      }),
    );
  }, 2 * 1000);
};

VbeeSpeech.prototype.receiveByteData = function({ uuid, bytes }) {
  this.uuid = uuid;
  if (this.recognizeStream) {
    try {
      logger.info(
        `[VbeeSpeech][receiveByteData] receive bytes data ${bytes.length}`,
      );
      let xrequest = {
        audio_content: bytes,
      };
      if (bytes.length === 0) {
        logger.info(
          '[VbeeSpeech][receiveByteData] length=0 Send done ++++++++++++++++++++',
        );
        xrequest = {
          audio_content: Buffer.from('DONE', 'utf8'),
        };
      }

      this.recognizeStream.write(xrequest);
    } catch (error) {
      logger.error(
        '[VbeeSpeech][receiveByteData] receive bytes data error: ',
        error.message,
      );

      this.stopRecognitionStream();
    }
  }
};

module.exports = { VbeeSpeech };
