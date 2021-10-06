const PROVIDER = {
  VBEE: 'vbee',
  VAIS: 'vais',
  GOOGLE: 'google',
};

const RECOGNIZE_STATE = {
  NORMAL: 0,
  DETECT_SILENT: 1,
  DETECT_NO_INPUT: 2,
  DETECT_RECOGNIZE_TIMEOUT: 3,
};

const REDIS_QUEUE_NAME = {
  REDIS_QUEUE_RECOGNIZE: 'speech-gate-queue-convert-tts',
  REDIS_QUEUE_RECOGNIZE_RESULT: 'redis_queue_recognize_result',
};

const VERSION_CHAT = {
  'VER1.1': '1.1',
};

module.exports = { PROVIDER, RECOGNIZE_STATE, REDIS_QUEUE_NAME, VERSION_CHAT };
