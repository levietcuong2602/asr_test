/* eslint-disable func-names */
const uuid = require('uuid');
const moment = require('moment-timezone');
const snakecaseKeys = require('snakecase-keys');
const WebSocketClient = require('websocket').client;

const { logger } = require('../utils/logger');
const { updateWorkflowAicc } = require('../utils/speech');
const { httpPOST } = require('../utils/utils');
const { PROVIDER, VERSION_CHAT } = require('../constants');

const WS_ENDPOINT =
  process.env.WS_CHAT_SMARTDIALOG || 'wss://lcp-chat.iristech.club';

function VbeeSmartdialog({
  appId,
  endpoint,
  textInit,
  callbackUrl,
  version,
  phoneNumber,
  callbackFunction,
  accessToken = '',
  sessionId,
  uuid,
  requestId,
  updateWorkflowUrl,
}) {
  this.uuid = uuid;
  this.sessionId = sessionId;
  this.requestId = requestId;
  this.updateWorkflowUrl = updateWorkflowUrl;
  this.appId = appId;
  this.endpoint = endpoint || WS_ENDPOINT;
  this.version = version;
  this.phoneNumber = phoneNumber;
  this.textInit = textInit || '';
  this.callbackFunction = callbackFunction;
  this.callbackUrl = callbackUrl;
  this.isSendInitRequest = false;
  this.accessToken = accessToken;
  this.asrAt = moment.tz(moment(), 'Asia/Ho_Chi_Minh').format();

  this.connect();
}

VbeeSmartdialog.prototype.connect = function() {
  this.client = new WebSocketClient();

  this.client.on('connectFailed', function(error) {
    logger.error('[VbeeSmartdialog][connectFailed] error: ', error.message);
    // TODO call function invoke
    const data = {
      error: 1,
      msg: `Connection timeout`,
    };
    if (!this.isSendInitRequest && this.callbackFunction) {
      this.callbackFunction(data, this.sessionId);
    }
  });

  const me = this;
  this.client.on('connect', function(connection) {
    me.connection = connection;
    logger.info(
      `[VbeeSmartdialog][connect] ${me.sessionId} ws client connected`,
    );
    // ping
    heartbeat(me, new Date().valueOf() / 1000);
    // TODO auto close after 5min

    // send message INIT
    me.send({
      type: 'INIT',
      return_array_action: true,
      app_id: me.appId,
      phone_number: me.phoneNumber,
    });

    // event
    connection.on('error', function(error) {
      logger.error(
        `[VbeeSmartdialog][conect error] client ${
          me.sessionId
        } Connect Error: `,
        error.message,
      );
    });

    connection.on('close', function() {
      me.connection = null;
      logger.warn(
        `[VbeeSmartdialog][connect close] client ${me.sessionId} Connect Close`,
      );
    });

    connection.on('message', function(message) {
      logger.info('[VbeeSmartdialog][message]', JSON.stringify(message));
      if (
        message.type === 'utf8' &&
        JSON.stringify(message).indexOf(
          'The connection cannot be established',
        ) === -1
      ) {
        const utf8Data = JSON.parse(message.utf8Data);
        const { type, status, access_token: accessToken } = utf8Data;
        if (!['PONG'].includes(type)) {
          logger.info(
            '[VbeeSmartdialog][message]',
            me.sessionId,
            message.utf8Data,
          );
        }

        if (type === 'INIT' && status === 1) {
          me.accessToken = accessToken;
          if (me.callbackFunction && me.textInit) {
            logger.info(
              `[VbeeSmartdialog][INIT] client Id ${
                me.sessionId
              } send init text: ${me.textInit}`,
            );
            me.sendMessage(me.textInit);
          }
        }

        if (type === 'CHAT' && status === 1) {
          const listActions = utf8Data.data.messages.map(msg => {
            return {
              action: msg.action && msg.action.name ? msg.action.name : 'play',
              content: msg.text,
              attachment: msg.attachment,
              asrProvider: utf8Data.data.asr_provider || PROVIDER.GOOGLE,
              expectedDataType:
                utf8Data.data.expected_data_type ||
                utf8Data.data.asr_expected_data_type,
              asrBreakingTime: utf8Data.data.asr_breaking_time || 300,
            };
          });
          const dataResult = snakecaseKeys(
            {
              error: 0,
              listActions,
              nlu: utf8Data.data.nlu || {},
              transcript: me.currentTranscript,
            },
            { deep: true },
          );
          logger.info(
            `[VbeeSmartdialog][CHAT] sessionId ${
              me.sessionId
            } chat list actions ${JSON.stringify(listActions)}`,
          );

          if (me.callbackFunction) {
            // init
            if (me.requestId && me.updateWorkflowUrl) {
              // update logs workflow aicallcenter
              const body = snakecaseKeys(
                {
                  error: 0,
                  requestId: me.requestId,
                  actions: listActions,
                  entities: utf8Data.data.nlu.entities || {},
                  intent: utf8Data.data.nlu.intent || {},
                  userSay: me.currentTranscript,
                  asrProcessTime: 0,
                  botProcessTime: 0,
                  asrAt: me.asrAt,
                },
                { deep: true },
              );
              logger.info(
                '[VbeeSmartdialog][CHAT] update result to aicallcenter params',
                JSON.stringify(body),
              );
              httpPOST({ url: me.updateWorkflowUrl, body }).then(res => {
                logger.info(
                  '[VbeeSmartdialog][CHAT] update result to aicallcenter result',
                  JSON.stringify(res),
                );
              });
            }

            switch (me.version) {
              case VERSION_CHAT['VER1.1']:
                me.callbackFunction(listActions[0].content);
                break;
              default:
                me.callbackFunction(dataResult, utf8Data.data.session_id);
                break;
            }

            me.isSendInitRequest = true;
            me.callbackFunction = null;
            me.textInit = '';
          } else {
            // send text to client
            updateWorkflowAicc(me.sessionId, JSON.stringify(dataResult));
          }
        }
      }
    });
  });

  logger.info(
    '[VbeeSmartdialog][connect] connect: ',
    JSON.stringify({ appId: this.appId, endpoint: this.endpoint }),
  );
  this.client.connect(this.endpoint);

  this.timeoutId = setTimeout(() => {
    const data = {
      error: 1,
      msg: 'Connect timeout',
    };
    if (!this.isSendInitRequest && this.callbackFunction) {
      this.callbackFunction(data, this.sessionId);
    }
  }, 5000);
};

VbeeSmartdialog.prototype.close = function() {
  logger.warn('[VbeeSmartdialog][close] vbee smartdialog close');

  try {
    if (this.connection) {
      this.connection.close();
    }
  } catch (err) {
    logger.info('[VbeeSmartdialog][close] error: ', err.message);
  }

  this.connection = null;
};

VbeeSmartdialog.prototype.send = function(data) {
  if (this.connection) {
    logger.info(
      `[VbeeSmartdialog][send] client ${
        this.sessionId
      } send message ${JSON.stringify(data)}`,
    );

    this.connection.send(JSON.stringify(data));
  } else {
    logger.error('[VbeeSmartdialog][send] fail not connect');
  }
};

VbeeSmartdialog.prototype.sendMessage = function(text) {
  this.currentTranscript = text;
  this.send({
    type: 'CHAT',
    access_token: this.accessToken,
    app_id: this.appId,
    message: {
      text,
      msg_id: uuid.v4(),
    },
  });
};

const heartbeat = function(ws, startTime) {
  const endTime = Math.floor(new Date().valueOf() / 1000);
  if (endTime - startTime > 10 * 60) {
    ws.connection.close();
    return;
  }
  if (ws.connection) {
    ws.connection.send(JSON.stringify({ type: 'PING' }));
    setTimeout(() => heartbeat(ws, startTime), 10 * 1000);
  }
};

module.exports = { VbeeSmartdialog };
