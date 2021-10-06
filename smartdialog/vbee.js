/* eslint-disable func-names */
const WebSocketClient = require('websocket').client;

const { logger } = require('../utils/logger');
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
}) {
  this.sessionId = ''; // uuid id lua
  this.clientId = ''; // session id ~ client id
  this.appId = appId;
  this.endpoint = endpoint || WS_ENDPOINT;
  this.version = version;
  this.phoneNumber = phoneNumber;
  this.textInit = textInit;
  this.callbackFunction = callbackFunction;
  this.callbackUrl = callbackUrl;
  this.isSendInitRequest = false;

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
      `[VbeeSmartdialog][connect] ${me.clientId} ws client connected`,
    );
    // ping
    heartbeat(me, new Date().valueOf() / 1000);
    // TODO auto close after 5min

    // send message INIT
    me.sendMessage({
      type: 'INIT',
      return_array_action: true,
      app_id: me.appId,
      phone_number: me.phoneNumber,
    });

    // event
    connection.on('error', function(error) {
      logger.error(
        `[VbeeSmartdialog][conect error] client ${me.clientId} Connect Error: `,
        error.message,
      );
    });

    connection.on('close', function() {
      me.connection = null;
      logger.error(
        `[VbeeSmartdialog][conect error] client ${me.clientId} Connect Close`,
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
            me.clientId,
            message.utf8Data,
          );
        }

        if (type === 'INIT' && status === 1) {
          me.accessToken = accessToken;
          if (me.callbackFunction && me.textInit.length > 0) {
            logger.info(
              `[VbeeSmartdialog][message] client Id ${
                me.clientId
              } send init text: ${me.textInit}`,
            );
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
          logger.info(
            `[VbeeSmartdialog][message] clientId ${
              me.clientId
            } chat list actions ${JSON.stringify(listActions)}`,
          );

          if (me.callbackFunction) {
            // init
          } else {
            // send text to client
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

VbeeSmartdialog.prototype.sendMessage = function(data) {
  if (this.connection) {
    logger.info(
      `[VbeeSmartdialog][sendMessage] client ${
        this.clientId
      } send message ${JSON.stringify(data)}`,
    );

    this.connection.send(JSON.stringify(data));
  } else {
    logger.error('[VbeeSmartdialog][sendMessage] fail not connect');
  }
};

const heartbeat = function(ws, startTime) {
  const endTime = Math.floor(new Date().valueOf() / 1000);
  if (endTime - startTime > 10 * 60) {
    ws.connection.close();
    return;
  }
  if (ws.connection) {
    ws.connection.sendMessage(JSON.stringify({ type: 'PING' }));
    setTimeout(() => heartbeat(ws, startTime), 10 * 1000);
  }
};

module.exports = { VbeeSmartdialog };
