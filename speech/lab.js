/* eslint-disable func-names */
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

require('dotenv').config();
const { logger } = require('../utils/logger');
const { publisher } = require('../utils/redis');
const { REDIS_QUEUE_NAME, PROVIDER } = require('../constants');

const API_KEY_DEFAULT = '6FV9YwvcaSugKq6k';

const PROTO_PATH = path.join(__dirname, '../lib/stt_lab_service.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const speech = grpc.loadPackageDefinition(packageDefinition).vbee.stt.v1;

function LabSpeech({
  sessionId,
  uuid,
  recognizeModel,
  phoneNumber,
  requestId,
}) {
  this.sessionId = sessionId;
  this.uuid = uuid;
  this.requestId = requestId;
  this.lastText = 'Im lặng';
  this.provider = PROVIDER.LAB;
  this.recognizeModel = recognizeModel;
  this.phoneNumber = phoneNumber;

  // variable
  const request = {
    config: {
      specification: {
        model: 'Wav2vec2',
        record: false,
        partial_results: true,
        single_utterance: false,
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
  this.startRecognitionStream({ request, phoneNumber });
}

LabSpeech.prototype.startRecognitionStream = function({
  request,
  phoneNumber = '',
}) {
  const endpoint = '6.tcp.ngrok.io:12834';
  const client = new speech.SttService(
    endpoint,
    grpc.credentials.createInsecure(),
  );
  const meta = new grpc.Metadata();
  meta.add('api-key', API_KEY_DEFAULT);
  meta.add('phone', phoneNumber);
  logger.info(
    `[LabSpeech] metadata: `,
    JSON.stringify({ apiKey: API_KEY_DEFAULT, phoneNumber }),
  );

  const me = this;
  this.recognizeStream = client
    .LogRecognize(meta)
    .on('data', function(data) {
      logger.warn('[LabSpeech][Transcription] data: ', JSON.stringify(data));
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
      logger.error('[LabSpeech][Transcription] error: ', err);
    })
    .on('end', function() {
      logger.info('[LabSpeech][Transcription] end');
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

LabSpeech.prototype.stopRecognitionStream = function(reson) {
  logger.info(
    '[LabSpeech][stopRecognitionStream] stop recognition stream: ',
    this.uuid,
    reson,
  );
  this.isStopRecognize = true;
  if (this.recognizeStream) {
    this.recognizeStream.end();
  }
  this.recognizeStream = null;
};

LabSpeech.prototype.receiveByteData = function({ uuid, bytes }) {
  this.uuid = uuid;
  if (this.recognizeStream) {
    try {
      logger.info(
        `[LabSpeech][receiveByteData] receive bytes data ${bytes.length}`,
      );
      let xrequest = {
        audio_content: bytes,
      };
      if (bytes.length === 0) {
        logger.info(
          '[LabSpeech][receiveByteData] length=0 Send done ++++++++++++++++++++',
        );
        xrequest = {
          audio_content: Buffer.from('DONE', 'utf8'),
        };
      }

      this.recognizeStream.write(xrequest);
    } catch (error) {
      logger.error(
        '[LabSpeech][receiveByteData] receive bytes data error: ',
        error.message,
      );

      this.stopRecognitionStream();
    }
  }
};

module.exports = { LabSpeech };
