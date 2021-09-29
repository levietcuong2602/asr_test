/* eslint-disable no-bitwise */
/* eslint-disable no-buffer-constructor */
/* eslint-disable func-names */
const fs = require('fs');

const { ServiceSpeech } = require('../speech');
const { logger } = require('../utils/logger');
const { ipHeader, getObjectFromConfigBuffer } = require('../utils/parser');
const { PROVIDER, RECOGNIZE_STATE, REDIS_QUEUE_NAME } = require('../constants');

const subRecognize = require('../utils/redis').subscriber();
const subRecognizeResult = require('../utils/redis').subscriber();
const subViewTimeAsr = require('../utils/redis').subscriber();

const REDIS_KEYS = {
  CHECK_SESSION_REQUEST: id => `check_session_request_${id}`,
  CHECK_AGENT_FORWARDED_CALL: (agentId, callId) =>
    `check_agent_${agentId}_forwarded_call_${callId}`,
  AGENT_BREAK_TIME: id => `break_time_agent_${id}_status`,
};

const testSpeech = () => {
  const test = ServiceSpeech(PROVIDER.VBEE);

  const audioDataStream = fs.createReadStream('./audio_237.wav', {
    highWaterMark: 320,
  });

  audioDataStream.on('data', chunk => {
    test.recognizeStream.write({ audio_content: chunk });
  });

  audioDataStream.on('end', () => {
    test.recognizeStream.end();
  });

  // fs.readFile("./test_01.raw", function (err, data) {
  //   if (err) throw err;
  //   let count = 0;
  //   const chunkSize = 640;
  //   for (var i = 0; i < data.length; i += chunkSize) {
  //     buffer = data.slice(i, Math.min(i + chunkSize, data.length));
  //     request = {
  //       audio_content: buffer,
  //     };
  //     count += 1;

  //     test.recognizeStream.write(request);
  //   }
  //  logger.info("count", count);
  //   test.recognizeStream.end();
  // });
};

const subscribeViewTimeAsr = () => {
  subViewTimeAsr.on('message', function(channel, message) {
    logger.info('subscribeViewTimeAsr', JSON.stringify(message));
    const data = new Buffer(message, 'base64');
  });
  subViewTimeAsr.subscribe('list_time_process_asr');
};

const subscribeRecognizeResult = () => {
  subRecognizeResult.on('message', function(channel, message) {
    logger.warn('[subscribeRecognizeResult] data: ', JSON.stringify(message));
    const { sessionId, uuid, isFinal, text } = JSON.parse(message);
  });
  subRecognizeResult.subscribe(REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT);
};

const subscribeRecognize = () => {
  subRecognize.on('message', function(channel, message) {
    logger.info('[subscribeRecognize] subscribe recognize');
    const buffer = new Buffer(message, 'base64');
    const { len_config: configLength, config } = ipHeader.parse(buffer);
    const {
      state,
      start_input_timers,
      no_input_timeout,
      recognition_timeout,
      session_id: sessionId,
      uuid: sessionIdLua,
      provider,
      recognize_model: recognizeModel,
      caller_id_number,
      destination_number,
      request_id: requestId,
      provider_backup: providerBackup,
      api_key: apiKey,
    } = getObjectFromConfigBuffer(config);
    logger.info(
      '[subscribeRecognize] data=',
      JSON.stringify({
        state,
        sessionId,
        sessionIdLua,
        provider,
        recognizeModel,
        providerBackup,
      }),
    );
    let speech = MAPING_REQUEST_SPEECH[sessionId] || null;
    if (!speech) {
      speech = ServiceSpeech(provider)({
        sessionId,
        uuid: sessionIdLua,
        recognizeModel,
        apiKey,
      });
      // TODO
      MAPING_REQUEST_SPEECH[sessionId] = speech;
    }

    const bytes = buffer.slice(8 + configLength);
    logger.info({ bytes });
    // receive bytes data
    speech.receiveByteData({ uuid: sessionIdLua, bytes });
    if (
      [
        RECOGNIZE_STATE.DETECT_SILENT,
        RECOGNIZE_STATE.DETECT_NO_INPUT,
        RECOGNIZE_STATE.DETECT_RECOGNIZE_TIMEOUT,
      ].includes(~~state)
    ) {
      // stop recognize
      speech.stopRecognitionStream();
    }
  });

  subRecognize.subscribe(REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE);
};

module.exports = {
  testSpeech,
  subscribeRecognize,
  subscribeRecognizeResult,
  subscribeViewTimeAsr,
};
