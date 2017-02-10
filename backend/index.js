'use strict';

const AwesomeModule = require('awesome-module');
const Dependency = AwesomeModule.AwesomeModuleDependency;
const path = require('path');
const glob = require('glob-all');
const _ = require('lodash');

const FRONTEND_JS_PATH = path.join(__dirname, '/../frontend/app/');
const APP_ENTRY_POINT = 'app.js';

const AwesomeCalendarModule = new AwesomeModule('linagora.esn.calendar', {
  dependencies: [
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.logger', 'logger'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.db', 'db'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.config', 'config'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.esn-config', 'esn-config'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.elasticsearch', 'elasticsearch'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.user', 'user'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.collaboration', 'collaboration'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.activitystreams', 'activitystreams'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.pubsub', 'pubsub'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.helpers', 'helpers'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.message', 'message'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.auth', 'auth'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.webserver.wrapper', 'webserver-wrapper'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.webserver.middleware.collaboration', 'collaborationMW'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.webserver.middleware.authorization', 'authorizationMW'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.webserver.middleware.token', 'tokenMW'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.email', 'email'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.wsserver', 'wsserver'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.i18n', 'i18n'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.davserver', 'davserver'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.cron', 'cron'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.core.amqp', 'amqpClientProvider'),
    new Dependency(Dependency.TYPE_NAME, 'linagora.esn.autoconf', 'autoconf', true)
  ],

  states: {
    lib: function(dependencies, callback) {
      const calendar = require('./webserver/api/calendar')(dependencies);
      const alarm = require('./lib/alarm')(dependencies);
      const eventMailListener = require('./lib/event-mail-listener')(dependencies);

      const lib = {
        alarm,
        eventMailListener,
        api: {
          calendar: calendar
        }
      };

      return callback(null, lib);
    },

    deploy: function(dependencies, callback) {
      // Init alarm local pubsub listener
      this.alarm.init();

      // Init bluebar event listener
      this.eventMailListener.init();

      // Register the new message type event
      const message = dependencies('message');

      message.registerMessageType('event', 'EventMessage');

      // Register the webapp
      const app = require('./webserver/application')(dependencies);

      app.use('/', this.api.calendar);

      const webserverWrapper = dependencies('webserver-wrapper');

      let frontendModules = glob.sync([
        FRONTEND_JS_PATH + '**/!(*spec).js'
      ]).map(filepath => filepath.replace(FRONTEND_JS_PATH, ''));

      _.pull(frontendModules, APP_ENTRY_POINT);
      frontendModules = [APP_ENTRY_POINT].concat(frontendModules);

      webserverWrapper.injectLess('calendar', [path.resolve(__dirname, '../frontend/app/styles.less')], 'esn');
      webserverWrapper.injectAngularAppModules('calendar', frontendModules, ['esn.calendar', 'esn.ical'], ['esn']);
      webserverWrapper.addApp('calendar', app);

      return callback();
    },

    start: function(dependencies, callback) {
      require('./ws/calendar').init(dependencies);
      require('./lib/search')(dependencies).listen();

      dependencies('autoconf') && dependencies('autoconf').addTransformer(require('./lib/autoconf')(dependencies));

      callback();
    }
  }
});

/**
 * The main AwesomeModule describing the application.
 * @type {AwesomeModule}
 */
module.exports = AwesomeCalendarModule;
