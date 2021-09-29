/* eslint-disable func-names */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const _ = require('lodash');

require('dotenv').config();
const { logger } = require('../utils/logger');
const { publisher } = require('../utils/redis');
const { REDIS_QUEUE_NAME } = require('../constants');

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

  // variable
  const request = {
    specification: {
      model: 'Wav2vec2',
      record: false,
      partial_results: true,
      single_utterance: false,
      interim_results: false,
      config: {
        encoding: 1,
        max_alternatives: 1,
        session_id: uuid,
        sample_rate_hertz: 8000,
        speech_contexts: [
          {
            phrases: [],
          },
        ],
        model_param: {
          graph: recognizeModel || 'general',
        },
      },
    },
  };
  // const request = {
  //   streaming_config: {
  //     model: 'Wav2vec2',
  //     single_utterance: true,
  //     interim_results: true,
  //     partial_results: true,
  //     config: {
  //       encoding: 1,
  //       max_alternatives: 1,
  //       session_id: uuid,
  //       sample_rate_hertz: 8000,
  //       speech_contexts: [
  //         {
  //           phrases: [],
  //         },
  //       ],
  //       model_param: {
  //         graph: recognizeModel || 'general',
  //       },
  //     },
  //   },
  // };
  this.startRecognitionStream({ request, apiKey: apiKey || API_KEY_DEFAULT });
}

VbeeSpeech.prototype.startRecognitionStream = function({ request, apiKey }) {
  const endpoint = '0.tcp.ngrok.io:16055';
  logger.info('endpoint', endpoint);

  const client = new speech.SttService(
    endpoint,
    grpc.credentials.createInsecure(),
  );
  logger.info('apiKey', apiKey);
  const meta = new grpc.Metadata();
  meta.add('api-key', apiKey);

  this.recognizeStream = client
    .StreamingRecognize(meta)
    .on('data', function(data) {
      logger.info('[VbeeSpeech][Transcription] data: ', JSON.stringify(data));
      const { text, final } = data;
      // send publish data
      publisher.publishAsync(
        REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT,
        JSON.stringify({
          sessionId: this.sessionId,
          uuid: this.uuid,
          isFinal: final,
          text,
        }),
      );
    })
    .on('error', function(err) {
      logger.error('[VbeeSpeech][Transcription] error: ', err);
    })
    .on('end', function() {
      logger.info('[VbeeSpeech][Transcription] end');
    });

  this.recognizeStream.write({ config: request });
};

VbeeSpeech.prototype.stopRecognitionStream = function() {
  logger.info('[VbeeSpeech][stopRecognitionStream] stop recognition stream');
  this.isStopRecognize = true;
  if (this.recognizeStream) {
    this.recognizeStream.end();
  }
  this.recognizeStream = null;

  setTimeout(() => {
    logger.info(
      this.sessionId,
      `[VbeeSpeech][stopRecognitionStream] auto close timeout`,
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

VbeeSpeech.prototype.receiveByteData = function({ uuid, bytes }) {
  this.uuid = uuid;
  if (this.recognizeStream && !this.isStopRecognize) {
    try {
      logger.info('[VbeeSpeech][receiveByteData] receive bytes data');
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
  } else {
    logger.error('[VbeeSpeech][receiveByteData] stream closed');
  }
};

module.exports = { VbeeSpeech };
