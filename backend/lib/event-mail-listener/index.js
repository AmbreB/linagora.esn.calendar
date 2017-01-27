'use strict';

const CONSTANTS = require('../constants');

module.exports = function(dependencies) {
  const esnConfig = dependencies('esn-config');
  const amqpClientProvider = dependencies('amqpClientProvider');
  const logger = dependencies('logger');
  const userModule = dependencies('user');
  const caldavClient = require('../caldav-client')(dependencies);

  return {
    init
  };

  function init() {
    return _getConfiguration().then(config => {
      if (config && config.exchanges && config.exchanges.length) {
        return config.exchanges.map(_subscribe);
      } else {
        logger.warn('CAlEventMailListener : Missing configuration in mongoDB');

        return _subscribe(CONSTANTS.EVENT_MAIL_LISTENER.FALLBACK_EXCHANGE);
      }
    })
    .catch(() => {
      logger.error('CAlEventMailListener : error when initialize the listener');
    });
  }

  function _subscribe(exchange) {
    const amqpClientPromise = amqpClientProvider.getClient();

    return amqpClientPromise.then(client => client.subscribe(exchange, _processMessage))
      .catch(() => {
        logger.error('CAlEventMailListener : Cannot connect to MQ ' + exchange);
      });
  }

  function _getConfiguration() {
    return esnConfig('external-event-listener').inModule('linagora.esn.calendar').get();
  }

  function _processMessage(jsonMessage) {
    if (!_checkMandatoryFields(jsonMessage)) {
      logger.warn('CAlEventMailListener : Missing mandatory field => Event ignored');

      return;
    }

    userModule.findByEmail(jsonMessage.recipient, (err, user) => {
        if (err) {
          logger.error('CAlEventMailListener : Could not connect to UserModule => Event ignored');

          return;
        }

        if (user) {
          _handleMessage(user.id, jsonMessage);
        } else {
          logger.warn('CAlEventMailListener : Recipient user unknown in OpenPaas => Event ignored');
        }
      }
    );
  }

  function _checkMandatoryFields(jsonMessage = {}) {
    return jsonMessage.method && jsonMessage.sender && jsonMessage.recipient && jsonMessage.uid;
  }

  function _handleMessage(userId, jsonMessage) {
    caldavClient.iTipRequest(userId, jsonMessage);
  }
};
