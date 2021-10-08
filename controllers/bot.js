const botService = require('../services/bot');
const { logger } = require('../utils/logger');

const initBot = async (req, res) => {
  const callback = (data, sessionId) => {
    logger.info(
      '[initBot][callback] data:',
      JSON.stringify({ data, sessionId }),
    );
    if (!data.error) {
      delete data.error;

      return res.send({ status: 1, data, sessionId });
    }

    return res.send({ status: 0 });
  };
  await botService.initBot({
    ...req.query,
    ...req.body,
    callback,
  });
};
const closeBot = async (req, res) => {
  await botService.closeBot({ ...req.query, ...req.body });

  return res.send({ status: 1 });
};

module.exports = { initBot, closeBot };
