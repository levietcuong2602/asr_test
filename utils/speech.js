const { httpGET, httpPOST } = require('./utils');
const { logger } = require('./logger');

const {
  ACCESS_TOKEN_PREDICT,
  PREDICT_DOMAIN,
  ASR_CORRECT_DOMAIN,
} = process.env;

const stopRecognizeTimeout = (speech, timeout) => {
  if (speech) return null;
  return setTimeout(() => {
    speech.stopRecognizeTimeout();
  }, timeout);
};

const predictResult = async (results = []) => {
  const data = await Promise.all(
    results.map(text =>
      httpGET({
        url: `${PREDICT_DOMAIN}/api/v1/tryit/predict`,
        params: {
          userSay: text,
          agentId: '60eca1640955b7d3650445ce',
        },
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN_PREDICT}`,
        },
        timeout: 30000,
      }),
    ),
  );

  logger.info(`[predictResult] result=`, JSON.stringify(data));

  let maxConfidence = -1;
  let selectIndex = -1;
  let index = 0;

  for (const info of data) {
    try {
      const jinfo = JSON.parse(info);
      // eslint-disable-next-line no-continue
      if (jinfo.status !== 1) continue;
      if (
        jinfo.nlu.confidence > maxConfidence &&
        jinfo.nlu.intent !== 'default_fallback_intent' &&
        jinfo.nlu.intent === 'y_dinh_thanh_toan'
      ) {
        maxConfidence = jinfo.nlu.confidence;
        selectIndex = index;
      }
    } catch (e) {
      logger.info('results predict exception', e.message);
    }
    index += 1;
  }
  if (selectIndex >= 0) {
    return results[selectIndex];
  }

  return null;
};

const correctAsrRequest = async body => {
  const data = await httpPOST(`${ASR_CORRECT_DOMAIN}/asr_post_correct`, body);
  if (data.error === 0) {
    return data.content;
  }

  return '';
};

module.exports = { stopRecognizeTimeout, predictResult, correctAsrRequest };
