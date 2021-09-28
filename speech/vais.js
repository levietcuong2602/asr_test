const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
require('dotenv').config();

const { logger } = require('../utils/logger');
const { publisher } = require('../utils/redis');
const { REDIS_QUEUE_NAME } = require('../constants');

const PROTO_PATH = path.join(__dirname, '../lib/stt_vais_service.proto');
const API_KEY_DEFAULT =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJydCI6MTU0NTcwNTE1MCwidWlkIjoiNWJjYjAzYjc1ODY1OTEwMDA5ZDlmMzM3In0.Sxx3h_tT7fnFiGx-7qUitBRhdOm6FV9YwvcaSugKq6k';

const options = {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
};
const packageDefinition = protoLoader.loadSync(PROTO_PATH, options);
const speech = grpc.loadPackageDefinition(packageDefinition).vais.cloud.speech
  .v1;

function VaisSpeech({ sessionId, uuid, recognizeModel, apiKey }) {
  this.sessionId = sessionId;
  this.uuid = uuid;
  this.lastText = 'Im lặng';

  // variable
  const request = {
    streaming_config: {
      single_utterance: true,
      interim_results: true,
      partial_results: true,
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

  this.startRecognitionStream({
    request,
    apiKey: apiKey || API_KEY_DEFAULT,
  });
}

VaisSpeech.prototype.startRecognitionStream = function({ request, apiKey }) {
  const endpoint = 'asr-telephone-fast.vais.vn:80';
  console.log('endpoint', endpoint);

  const client = new speech.Speech(endpoint, grpc.credentials.createInsecure());
  const meta = new grpc.Metadata();
  meta.add('api-key', apiKey);

  this.recognizeStream = client
    .StreamingRecognize(meta)
    .on('data', function(data) {
      logger.info('[VaisSpeech][Transcription] data: ', JSON.stringify(data));
      const results = data.results;

      let transcript = '';
      let isFinal = true;
      if (results.length != 0) {
        isFinal = results[0].is_final;
        transcript = results[0].alternatives[0].transcript.trim();
        logger.info(
          '[VaisSpeech][Transcription]: ',
          JSON.stringify({ transcript, isFinal }),
        );

        if (!transcript) {
          const words = data.results[0].alternatives[0].words || [];
          transcript = words.map(({ word }) => word).join(' ');
        }
        logger.warn('[VaisSpeech][Transcription] transcript= ', transcript);
      } else {
        logger.error('[VaisSpeech][Transcription] error data.results.length=0');
      }
      // send publish data
      publisher.publishAsync(
        REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT,
        JSON.stringify({
          sessionId: this.sessionId,
          uuid: this.uuid,
          isFinal,
          text: transcript,
        }),
      );
    })
    .on('error', function(err) {
      console.log('error: ', err);
    })
    .on('end', function() {
      console.log('end');
    });

  this.recognizeStream.write(request);
};

VaisSpeech.prototype.stopRecognitionStream = function() {
  logger.info('[VaisSpeech][stopRecognitionStream] stop recognition stream');
  this.isStopRecognize = true;
  if (this.recognizeStream) {
    this.recognizeStream.end();
  }
  this.recognizeStream = null;

  setTimeout(() => {
    logger.info(
      this.sessionId,
      `[VaisSpeech][stopRecognitionStream] auto close timeout`,
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

VaisSpeech.prototype.receiveByteData = function({ uuid, bytes }) {
  this.uuid = uuid;
  if (this.recognizeStream && !this.isStopRecognize) {
    try {
      logger.info('[VaisSpeech][receiveByteData] receive bytes data');
      let xrequest = {
        audio_content: bytes,
      };
      if (bytes.length === 0) {
        logger.info(
          '[VaisSpeech][receiveByteData] length=0 Send done ++++++++++++++++++++',
        );
        xrequest = {
          audio_content: Buffer.from('DONE', 'utf8'),
        };
      }

      this.recognizeStream.write(xrequest);
    } catch (error) {
      logger.error(
        '[VaisSpeech][receiveByteData] receive bytes data error: ',
        e.message,
      );

      this.stopRecognitionStream();
    }
  } else {
    logger.error('[VaisSpeech][receiveByteData] stream closed');
  }
};

module.exports = { VaisSpeech };
