const fs = require('fs');

const { ServiceSpeech } = require('../speech');
const { logger } = require('../utils/logger');
const { ipHeader, getObjectFromConfigBuffer } = require('../utils/parser');
const { PROVIDER, RECOGNIZE_STATE, REDIS_QUEUE_NAME } = require('../constants');

const MAPING_REQUEST_SPEECH = {};

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
  //   console.log("count", count);
  //   test.recognizeStream.end();
  // });
};

const subscribeViewTimeAsr = () => {
  const { subscriber } = require('../utils/redis');
  subscriber.on('message', function(channel, message) {
    console.log('subscribeViewTimeAsr', JSON.stringify(message));
    const data = new Buffer(message, 'base64');
  });
  subscriber.subscribe('list_time_process_asr');
};

const subscribeRecognizeResult = () => {
  const { subscriber } = require('../utils/redis');
  subscriber.on('message', function(channel, message) {
    console.log('[subscribeRecognizeResult] data: ', JSON.stringify(message));
    const buffer = new Buffer(message, 'base64');
    const { len_config: configLength, config } = ipHeader.parse(buffer);
    console.log(
      '[subscribeRecognizeResult] data: ',
      JSON.stringify({ configLength, config }),
    );
  });
  subscriber.subscribe(REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE_RESULT);
};

const subscribeRecognize = () => {
  const { subscriber } = require('../utils/redis');
  subscriber.on('message', function(channel, message) {
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
    console.log({ bytes });
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

  subscriber.subscribe(REDIS_QUEUE_NAME.REDIS_QUEUE_RECOGNIZE);
};

module.exports = {
  testSpeech,
  subscribeRecognize,
  subscribeRecognizeResult,
  subscribeViewTimeAsr,
};
