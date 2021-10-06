/* eslint-disable no-bitwise */
/* eslint-disable no-buffer-constructor */
/* eslint-disable func-names */
const fs = require('fs');

const { ServiceSpeech } = require('../speech');
const { VbeeSmartdialog } = require('../smartdialog/vbee');
const { logger } = require('../utils/logger');
const { ipHeader, getObjectFromConfigBuffer } = require('../utils/parser');
const { stopRecognizeTimeout } = require('../utils/speech');
const { saveVariableGlobal } = require('../utils/utils');

const { PROVIDER, RECOGNIZE_STATE, REDIS_QUEUE_NAME } = require('../constants');

const { client: redisClient } = require('../utils/redis');
const { request } = require('http');
const subRecognize = require('../utils/redis').subscriber();
const subRecognizeResult = require('../utils/redis').subscriber();
const subViewTimeAsr = require('../utils/redis').subscriber();

const MAPING_REQUEST_SPEECH = {};
const MAPING_REQUEST_SMARTDIALOG = {};

const REDIS_KEYS = {
  CHECK_SESSION_REQUEST: id => `check_session_request_${id}`,
  CHECK_SEND_BY_SESSION: id => `check_send_BY_SESSION_${id}`,
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
  subRecognizeResult.on('message', async function(channel, message) {
    logger.warn(
      '[asr][subscribeRecognizeResult] data: ',
      JSON.stringify(message),
    );
    const { sessionId, uuid, isFinal, text } = JSON.parse(message);

    const speech = MAPING_REQUEST_SPEECH[sessionId] || null;
    const speechBackup =
      MAPING_REQUEST_SPEECH[`speech_backup_${sessionId}`] || null;

    if (speech) return;
    // check 2s mà nội dung không thay đổi thì ngắt
    if (!isFinal && text) {
      const currentTime = Math.floor(new Date().valueOf() / 1000);
      const {
        lastTimeTextChange,
        isStopRecognize,
        lastText,
        recognizeTimeoutId,
      } = speech;
      if (
        !isStopRecognize &&
        lastTimeTextChange &&
        lastText === text &&
        currentTime - lastTime >= 2 &&
        speech
      ) {
        logger.info(
          '[asr][subscribeRecognizeResult] stop recognize because text not change after 2s',
        );
        speech.lastTimeTextChange = currentTime;
        if (recognizeTimeoutId) {
          clearTimeout(recognizeTimeoutId);
        }
        speech.stopRecognitionStream();
      }

      if (lastTimeTextChange || lastText !== text) {
        speech.lastTimeTextChange = currentTime;
      }
    }
    // set timeout stop recognize
    if (speech && speech.recognizeTimeoutId) {
      clearTimeout(speech.recognizeTimeoutId);
    }
    if (speech && !isFinal) {
      speech.recognizeTimeoutId = stopRecognizeTimeout(speech, 2000);
    }
    if (!isFinal) return null;

    // check session send message
    const isSendRequest = await redisClient.getAsync(
      REDIS_KEYS.CHECK_SEND_BY_SESSION(sessionId),
    );
    if (isSendRequest) {
      return;
    }
    await redisClient.setAsync(
      REDIS_KEYS.CHECK_SEND_BY_SESSION(sessionId),
      true,
      'EX',
      300,
    );

    if (speech) {
      speech.stopRecognitionStream();
    }
    if (speechBackup) {
      speechBackup.stopRecognitionStream();
    }

    // evaluate result recognize

    return true;
  });
  subRecognizeResult.subscribe(REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT);
};

const subscribeRecognize = () => {
  subRecognize.on('message', function(channel, message) {
    const buffer = new Buffer(message, 'base64');
    const { len_config: configLength, config } = ipHeader.parse(buffer);
    const {
      state,
      session_id: sessionId,
      uuid: sessionIdLua,
      provider,
      recognize_model: recognizeModel,
      request_id: requestId,
      provider_backup: providerBackup,
      api_key: apiKey,
    } = getObjectFromConfigBuffer(config);
    // logger.info(
    //   '[asr][subscribeRecognize] data=',
    //   JSON.stringify({
    //     state,
    //     sessionId,
    //     sessionIdLua,
    //     provider,
    //     recognizeModel,
    //     providerBackup,
    //   }),
    // );
    let speech = MAPING_REQUEST_SPEECH[sessionId] || null;
    let speechBackup =
      MAPING_REQUEST_SPEECH[`speech_backup_${sessionId}`] || null;
    let smartdialog = MAPING_REQUEST_SMARTDIALOG[uuid] || null;

    if (!speech) {
      speech = ServiceSpeech(provider)({
        sessionId,
        uuid: sessionIdLua,
        recognizeModel,
        apiKey,
      });
      // save speech into varivale global
      saveVariableGlobal(MAPING_REQUEST_SPEECH, sessionId, speech);
      // set field speech
      speech.requestId = requestId;

      // settimout stop recognize
      speech.recognizeTimeoutId = stopRecognizeTimeout(speech, 6000);

      if (providerBackup) {
        speechBackup = ServiceSpeech(provider)({
          sessionId,
          uuid: sessionIdLua,
          recognizeModel,
          apiKey,
        });
        // save speech into varivale global
        saveVariableGlobal(
          MAPING_REQUEST_SPEECH,
          `speech_backup_${sessionId}`,
          speechBackup,
        );
      }
    }

    if (smartdialog) {
      smartdialog.requestId = requestId;
      smartdialog.clientId = sessionId;
    }

    const bytes = buffer.slice(8 + configLength);
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

    // speech backup
    if (speechBackup) {
      speechBackup.receiveByteData({ uuid: sessionIdLua, bytes });
      if (
        [
          RECOGNIZE_STATE.DETECT_SILENT,
          RECOGNIZE_STATE.DETECT_NO_INPUT,
          RECOGNIZE_STATE.DETECT_RECOGNIZE_TIMEOUT,
        ].includes(~~state)
      ) {
        // stop recognize
        speechBackup.stopRecognitionStream();
      }
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
