/* eslint-disable no-undef */
/* eslint-disable no-bitwise */
/* eslint-disable func-names */
const fs = require('fs');
const moment = require('moment-timezone');

const { ServiceSpeech } = require('../speech');
const { logger } = require('../utils/logger');
const { ipHeader, getObjectFromConfigBuffer } = require('../utils/parser');
const {
  stopRecognizeTimeout,
  predictResult,
  correctAsrRequest,
  updateWorkflowAicc,
} = require('../utils/speech');
const { saveVariableGlobal } = require('../utils/utils');

const {
  PROVIDER,
  RECOGNIZE_STATE,
  REDIS_QUEUE_NAME,
  REDIS_KEYS,
} = require('../constants');

const { client: redisClient } = require('../utils/redis');
const subRecognize = require('../utils/redis').subscriber();
const subRecognizeResult = require('../utils/redis').subscriber();
const subViewTimeAsr = require('../utils/redis').subscriber();

const testSpeech = () => {
  const test = ServiceSpeech(PROVIDER.VBEE)({});
  const audioDataStream = fs.createReadStream('./test.wav');
  audioDataStream.on('data', chunk => {
    test.receiveByteData({ bytes: chunk });
  });
  audioDataStream.on('end', () => {
    test.stopRecognitionStream();
  });
  // fs.readFile('./test_01.raw', function(err, data) {
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
  //   logger.info('count', count);
  //   test.recognizeStream.end();
  // });
  // logger.info('[test] set variable');
  // saveVariableGlobal(MAPING_REQUEST_SPEECH, 'abc', '123');
};

const subscribeViewTimeAsr = () => {
  subViewTimeAsr.on('message', function(channel, message) {
    logger.info('subscribeViewTimeAsr', JSON.stringify(message));
    const data = Buffer.from(message, 'base64');
  });
  subViewTimeAsr.subscribe('list_time_process_asr');
};

const subscribeRecognizeResult = () => {
  subRecognizeResult.on('message', async function(channel, message) {
    logger.warn(
      '[asr][subscribeRecognizeResult] data: ',
      JSON.stringify(message),
    );
    const { sessionId, uuid, isFinal, provider } = JSON.parse(message);
    let { text } = JSON.parse(message);

    const speech = MAPING_REQUEST_SPEECH[sessionId] || null;
    const speechBackup =
      MAPING_REQUEST_SPEECH[`speech_backup_${sessionId}`] || null;
    const speechLab = MAPING_REQUEST_SPEECH[`speech_lab_${sessionId}`] || null;
    const smartdialog = MAPING_REQUEST_SMARTDIALOG[uuid] || null;

    if (speechLab && speechLab.provider === provider) {
      speechLab.stopRecognitionStream('final=true speechLab stop recognize');
      return;
    }

    if (!speech) return;
    // check 2s mà nội dung không thay đổi thì ngắt
    if (!isFinal && text) {
      const currentTime = Math.floor(new Date().valueOf() / 1000);
      const {
        lastTimeTextChange,
        isStopRecognize,
        lastText,
        recognizeTimeoutId,
      } = speech;
      if (lastTimeTextChange) {
        logger.info(
          `[asr][subscribeRecognizeResult] ${sessionId} last time text change`,
        );
      } else {
        logger.info(
          `[asr][subscribeRecognizeResult] ${sessionId} last time text change init`,
        );
      }
      if (
        !isStopRecognize &&
        lastTimeTextChange &&
        lastText === text &&
        currentTime - lastTimeTextChange >= 2 &&
        speech
      ) {
        logger.info(
          '[asr][subscribeRecognizeResult] stop recognize because text not change after 2s',
        );
        speech.lastTimeTextChange = currentTime;
        if (recognizeTimeoutId) {
          clearTimeout(recognizeTimeoutId);
        }
        speech.stopRecognitionStream(
          'stop recognize because text not change after 2s',
        );
      }

      if (!lastTimeTextChange || lastText !== text) {
        speech.lastTimeTextChange = currentTime;
      }
    }

    if (text.length > 0 && speech.provider === provider) {
      speech.lastText = text;
    }
    if (speechBackup && text.length > 0 && speechBackup.provider === provider) {
      speechBackup.lastText = text;
    }
    // set timeout stop recognize after 2s
    if (speech.recognizeTimeoutId) {
      clearTimeout(speech.recognizeTimeoutId);
    }
    if (!isFinal) {
      speech.recognizeTimeoutId = stopRecognizeTimeout(speech, 2000);
    }
    if (!isFinal) return;

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

    let lastTextProvider = speech.lastText || '';
    speech.stopRecognitionStream('final=true speech stop recognize');

    let lastTextProviderBackup = '';
    if (speechBackup) {
      lastTextProviderBackup = speechBackup.lastText || '';
      speechBackup.stopRecognitionStream(
        'final=true speechBackup stop recognize',
      );
    }

    // TODO check silent

    // not connect smartdialog
    if (!smartdialog) return await updateWorkflowAicc({ sessionId, text });
    // evaluate result recognize
    if (
      text.toLowerCase() === 'im lặng' &&
      lastTextProvider.toLowerCase() !== 'im lặng'
    ) {
      text = lastTextProvider;
    }
    if (
      text.toLowerCase() === 'im lặng' &&
      lastTextProviderBackup.toLowerCase() !== 'im lặng'
    ) {
      text = lastTextProviderBackup;
    }

    logger.info(
      `[asr][subscribeRecognizeResult] ${sessionId} text info request predict`,
      JSON.stringify([text, lastTextProvider, lastTextProviderBackup]),
    );
    const { recognizeModel } = speech;
    const speechTextValid =
      lastTextProvider && lastTextProvider.toLowerCase() !== 'im lặng';
    const speechBackupTextValid =
      lastTextProviderBackup &&
      lastTextProviderBackup.toLowerCase() !== 'im lặng';
    if (
      ['yes_no'].includes(recognizeModel) &&
      speechTextValid &&
      speechBackupTextValid
    ) {
      const predict = await predictResult([
        lastTextProviderBackup,
        lastTextProvider,
      ]);
      logger.info('[asr][subscribeRecognizeResult] predict result: ', predict);
      if (predict) {
        text = predict;
      }
    }

    if (['date', 'number'].includes(recognizeModel)) {
      const correctAsr = await correctAsrRequest({
        sentence: text,
        type: recognizeModel,
      });
      if (correctAsr) {
        text = correctAsr;
      }
    }
    // smartdialog send message
    smartdialog.sendMessage(text);
  });
  subRecognizeResult.subscribe(REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT);
};

const subscribeRecognize = () => {
  subRecognize.on('message', function(channel, message) {
    const buffer = Buffer.from(message, 'base64');
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
    let speechLab = MAPING_REQUEST_SPEECH[`speech_lab_${sessionId}`] || null;
    const smartdialog = MAPING_REQUEST_SMARTDIALOG[sessionIdLua] || null;

    if (!speech) {
      speech = ServiceSpeech(provider)({
        sessionId,
        uuid: sessionIdLua,
        recognizeModel,
        apiKey,
        requestId,
      });
      // save speech into varivale global
      saveVariableGlobal(MAPING_REQUEST_SPEECH, sessionId, speech);
      // set field speech
      speech.requestId = requestId;

      // settimout stop recognize
      speech.recognizeTimeoutId = stopRecognizeTimeout(speech, 6000);

      // stream backup
      if (
        !speechBackup ||
        (speechBackup && speechBackup.provider !== providerBackup)
      ) {
        speechBackup = ServiceSpeech(providerBackup)({
          sessionId,
          uuid: sessionIdLua,
          recognizeModel,
          apiKey,
          requestId,
        });
        // save speech into varivale global
        saveVariableGlobal(
          MAPING_REQUEST_SPEECH,
          `speech_backup_${sessionId}`,
          speechBackup,
        );
      }

      // set start time process asr
      speech.startTimeProcess = Math.floor(new Date().valueOf() / 1000);
    }
    if (!speechLab) {
      // stream logs
      speechLab = ServiceSpeech(PROVIDER.LAB)({
        sessionId,
        uuid: sessionIdLua,
        recognizeModel,
        phoneNumber: smartdialog ? smartdialog.phoneNumber : '',
        requestId,
      });
      saveVariableGlobal(
        MAPING_REQUEST_SPEECH,
        `speech_lab_${sessionId}`,
        speechLab,
      );
    }

    if (smartdialog) {
      smartdialog.requestId = requestId;
      smartdialog.sessionId = sessionId;
      smartdialog.uuid = sessionIdLua;

      speech.updateWorkflowUrl = smartdialog.updateWorkflowUrl;
      speech.asrAt = moment.tz(moment(), 'Asia/Ho_Chi_Minh').format();
    }

    const bytes = buffer.slice(8 + configLength);
    // receive bytes data
    speech.receiveByteData({ uuid: sessionIdLua, bytes });
    if (
      [
        RECOGNIZE_STATE.DETECT_SILENT,
        RECOGNIZE_STATE.DETECT_NO_INPUT,
        RECOGNIZE_STATE.DETECT_RECOGNIZE_TIMEOUT,
      ].includes(~~state) &&
      !speech.isStopRecognize
    ) {
      // stop recognize
      speech.stopRecognitionStream(`state=${state} speech stop recognize`);
    }

    // speech backup
    if (speechBackup) {
      speechBackup.receiveByteData({ uuid: sessionIdLua, bytes });
      if (
        [
          RECOGNIZE_STATE.DETECT_SILENT,
          RECOGNIZE_STATE.DETECT_NO_INPUT,
          RECOGNIZE_STATE.DETECT_RECOGNIZE_TIMEOUT,
        ].includes(~~state) &&
        !speechBackup.isStopRecognize
      ) {
        // stop recognize
        speechBackup.stopRecognitionStream(
          `state=${state} speechBackup stop recognize`,
        );
      }
    }

    // speech lab
    if (speechLab) {
      speechLab.receiveByteData({ uuid: sessionIdLua, bytes });
      if (
        [
          RECOGNIZE_STATE.DETECT_SILENT,
          RECOGNIZE_STATE.DETECT_NO_INPUT,
          RECOGNIZE_STATE.DETECT_RECOGNIZE_TIMEOUT,
        ].includes(~~state) &&
        !speechLab.isStopRecognize
      ) {
        // stop recognize
        speechLab.stopRecognitionStream(
          `state=${state} speechLab stop recognize`,
        );
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
