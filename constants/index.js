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
  'VER1.2': '1.2',
};

const REDIS_KEYS = {
  CHECK_SESSION_REQUEST: id => `check_session_request_${id}`,
  CHECK_SEND_BY_SESSION: id => `check_send_by_session_${id}`,
  CHECK_SESSION_APP_ID: id => `check_session_app_id_${id}`,
};

module.exports = {
  PROVIDER,
  RECOGNIZE_STATE,
  REDIS_QUEUE_NAME,
  VERSION_CHAT,
  REDIS_KEYS,
};
