const { VbeeSmartdialog } = require('../smartdialog/vbee');
const { REDIS_KEYS } = require('../constants');
const { logger } = require('../utils/logger');
const { client: redisClient } = require('../utils/redis');
const { saveVariableGlobal } = require('../utils/utils');

const initBot = async ({
  text,
  sessionIdLua,
  appId,
  endPoint,
  callbackUrl,
  version,
  phoneNumber,
  updateWorkflowUrl,
  requestId,
}) => {
  logger.info(
    '[bot][initBot] request init bot: ',
    JSON.stringify({
      text,
      sessionIdLua,
      appId,
      endPoint,
      callbackUrl,
      version,
      phoneNumber,
      updateWorkflowUrl,
      requestId,
    }),
  );

  await redisClient.setAsync(
    REDIS_KEYS.CHECK_SESSION_APP_ID(sessionIdLua),
    appId,
    'EX',
    300,
  );
  let result = null;
  const smartdialog = new VbeeSmartdialog({
    appId,
    endpoint: endPoint,
    textInit: text,
    callbackFunction: (data, sessionId) => {
      result = { ...data, sessionId };
    },
    callbackUrl,
    version,
    phoneNumber,
    sessionId: sessionIdLua,
    requestId,
    updateWorkflowUrl,
  });

  // save speech into varivale global
  // eslint-disable-next-line no-undef
  saveVariableGlobal(MAPING_REQUEST_SMARTDIALOG, sessionIdLua, smartdialog);
  return result;
};

const closeBot = async ({ sessionIdLua }) => {
  // eslint-disable-next-line no-undef
  const smardialog = MAPING_REQUEST_SMARTDIALOG[sessionIdLua];
  if (smardialog) {
    smardialog.close();
  }

  return true;
};

module.exports = { initBot, closeBot };
