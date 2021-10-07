const botService = require('../services/bot');

const initBot = async (req, res) => {
  const result = await botService.initBot({ ...req.query, ...req.body });

  return res.send({ status: 1, result });
};
const closeBot = async (req, res) => {
  await botService.closeBot({ ...req.query, ...req.body });

  return res.send({ status: 1 });
};

module.exports = { initBot, closeBot };
