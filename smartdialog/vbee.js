/* eslint-disable func-names */
const WebSocketClient = require('websocket').client;

const { logger } = require('../utils/logger');

const WS_ENDPOINT =
  process.env.WS_CHAT_SMARTDIALOG || 'wss://lcp-chat.iristech.club';

function VbeeSmartdialog({
  appId,
  endpoint,
  textInit,
  callbackUrl,
  version,
  phoneNumber,
  functionCallInvoke,
}) {
  this.appId = appId;
  this.endpoint = endpoint || WS_ENDPOINT;
  this.version = version;
  this.phoneNumber = phoneNumber;
  this.textInit = textInit;
  this.functionCallInvoke = functionCallInvoke;
  this.callbackUrl = callbackUrl;

  this.connect();
}

VbeeSmartdialog.prototype.connect = function() {
  this.client = new WebSocketClient();

  this.client.on('connectFailed', function(error) {
    logger.error('[VbeeSmartdialog][connectFailed] error: ', error.message);
    // TODO call function invoke
  });

  const me = this;
  this.client.on('connect', function(connection) {
    me.connection = connection;

    // TODO auto close

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
        `[VbeeSmartdialog][conect error] client ${
          this.clientId
        } Connect Error: `,
        error.message,
      );
    });

    connection.on('close', function() {
      me.connection = null;
      logger.error(
        `[VbeeSmartdialog][conect error] client ${this.clientId} Connect Close`,
      );
    });

    connection.on('message', function(message) {
      logger.info('[VbeeSmartdialog][message]', JSON.stringify(message));
    });
  });

  logger.info(
    '[VbeeSmartdialog][connect] connect: ',
    JSON.stringify({ appId: this.appId, endpoint: this.endpoint }),
  );
  this.client.connect(this.endpoint);
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

module.exports = { VbeeSmartdialog };
