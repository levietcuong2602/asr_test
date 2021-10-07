const { Joi } = require('express-validation');

const { customValidate } = require('./validationUtil');
const { VERSION_CHAT } = require('../constants');

const initBot = {
  query: Joi.object({
    text: Joi.string(),
    sessionIdLua: Joi.string().required(),
    appId: Joi.string().required(),
    endPoint: Joi.string().required(),
    callbackUrl: Joi.string(),
    version: Joi.string().default(VERSION_CHAT),
    phoneNumber: Joi.string(),
    updateWorkflowUrl: Joi.string(),
    requestId: Joi.string(),
  }),
};

const closeBot = {
  query: Joi.object({
    sessionIdLua: Joi.string().required(),
  }),
};

module.exports = {
  initBotValidate: customValidate(initBot, {}, { allowUnknown: true }),
  closeBotValidate: customValidate(closeBot, {}, { allowUnknown: true }),
};
