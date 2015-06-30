'use strict';

var async = require('async');
var q = require('q');
var jcal2content = require('../../../lib/jcal/jcalHelper').jcal2content;
var eventMessage,
    i18n,
    userModule,
    collaborationModule,
    messageHelpers,
    arrayHelpers,
    activityStreamHelper,
    localpubsub,
    globalpubsub,
    collaborationPermission,
    contentSender,
    esnconfig,
    staticConfig;

var MAIL_TEMPLATE = 'event.invitation';

/**
 * Check if the user has the right to create an eventmessage in that
 * collaboration and create the event message and the timeline entry. The
 * callback function is called with either the saved event message or false if
 * the user doesn't have write permissions.
 *
 * @param {object} user             The user object from req.user
 * @param {object} collaboration    The collaboration object from req.collaboration
 * @param {object} event            The event data, see REST_calendars.md
 * @param {function} callback       The callback function
 */
function _create(user, collaboration, event, callback) {
  var userData = {objectType: 'user', id: user._id};

  collaborationPermission.canWrite(collaboration, userData, function(err, result) {
    if (err || !result) {
      return callback(err, result);
    }
    var shares = [{
      objectType: 'activitystream',
      id: collaboration.activity_stream.uuid
    }];

    eventMessage.save({eventId: event.event_id, author: user, shares: shares}, function(err, saved) {
      if (err) {
        return callback(err);
      }

      var targets = messageHelpers.messageSharesToTimelineTarget(saved.shares);
      var activity = activityStreamHelper.userMessageToTimelineEntry(saved, 'post', user, targets);
      localpubsub.topic('message:activity').forward(globalpubsub, activity);
      return callback(null, saved);
    });
  });
}

/**
 * Update the event message belonging to the specified calendar event
 *
 * @param {object} user             The user object from req.user
 * @param {object} collaboration    The collaboration object from req.collaboration
 * @param {object} event            The event data, see REST_calendars.md
 * @param {function} callback       The callback function
 */
function _update(user, collaboration, event, callback) {
  eventMessage.findByEventId(event.event_id, function(err, message) {
    if (err) {
      return callback(err);
    }
    if (!message) {
      return callback(new Error('Could not find matching event message'));
    }

    // For now all we will do is send a new message:activity notification, but
    // with verb |update| instead of |post| to denote the update.
    var targets = messageHelpers.messageSharesToTimelineTarget(message.shares);
    var activity = activityStreamHelper.userMessageToTimelineEntry(message, 'update', user, targets);
    localpubsub.topic('message:activity').forward(globalpubsub, activity);
    return callback(null, message);
  });
}

/**
 * Validate the data structure and forward it to the right handler. This method
 * can be used to process message queue data. The message data format is as
 * follows:
 *   {
 *     user: "userid", // This can be the user id or a user object
 *     collaboration: "collabid", // This can be the collab id or object
 *     event: {  // The message event data
 *       event_id: '/path/to/event', // An event identifier
 *       type: 'created', // The operation to execute
 *       event: 'BEGIN:VCALENDAR...', /// The event ics data
 *     }
 *   }
 *
 * The callback result is false if there was a permission issue. Otherwise it
 * is an object with the event message data created or updated.
 *
 * @param {object} data         The data which contain the user, the community
 *                                and the event
 * @param {function} callback   Callback function for results: function(err, result)
 */
function dispatch(data, callback) {
  if (!data || typeof data !== 'object') {
    return callback(new Error('Data is missing'));
  }
  if (!data.user) {
    return callback(new Error('Invalid user specified'));
  }
  if (!data.collaboration) {
    return callback(new Error('Invalid collaboration specified'));
  }
  if (!data.event || !data.event.event_id) {
    return callback(new Error('Invalid event specified'));
  }

  var retrievals = [
    function retrieveUser(callback) {
      if (typeof data.user === 'object') {
        return callback(null, data.user);
      } else if (typeof data.user === 'string') {
        userModule.get(data.user, callback);
      } else {
        return callback('Invalid user data');
      }
    },
    function retrieveCollaboration(callback) {
      if (typeof data.collaboration === 'object') {
        return callback(null, data.collaboration);
      } else if (typeof data.collaboration === 'string' && data.objectType) {
        collaborationModule.queryOne(data.objectType, data.collaboration, callback);
      } else {
        return callback('Missing collaboration');
      }
    }
  ];

  async.parallel(retrievals, function(err, result) {
    if (err) {
      return callback(new Error('Error dispatching event: ' + err));
    }
    data.user = result[0]; data.collaboration = result[1];

    switch (data.event.type) {
      case 'created':
        return _create(data.user, data.collaboration, data.event, callback);
      case 'updated':
        return _update(data.user, data.collaboration, data.event, callback);
      default:
        return callback(new Error('Invalid type specified'));
    }
  });
}
module.exports.dispatch = dispatch;

function inviteAttendees(organizer, attendeeEmails, notify, method, ics, callback) {
  if (!notify) {
    return q({}).nodeify(callback);
  }

  if (!organizer) {
    return q.reject(new Error('Organizer must be an User object')).nodeify(callback);
  }

  if (arrayHelpers.isNullOrEmpty(attendeeEmails)) {
    return q.reject(new Error('AttendeeEmails must an array with at least one email')).nodeify(callback);
  }

  if (!method) {
    return q.reject(new Error('The method is required')).nodeify(callback);
  }

  if (!ics) {
    return q.reject(new Error('The ics is required')).nodeify(callback);
  }

  function userDisplayName(user) {
    return user.firstname + ' ' + user.lastname;
  }

  var getAllUsersAttendees = attendeeEmails.map(function(attendeeEmail) {
    return q.nfcall(userModule.findByEmail, attendeeEmail);
  });

  return esnconfig('web').get(function(web) {
    var baseUrl = 'http://localhost:';
    if (web && web.base_url) {
      baseUrl = web.base_url;
    } else {
      var port = staticConfig.webserver.port || '8080';
      baseUrl += port;
    }

    return q.all(getAllUsersAttendees).then(function(users) {

      var sendMailToAllAttendees = users.filter(Boolean).map(function(user) {

        var from = { objectType: 'email', id: organizer.emails[0] };
        var to = { objectType: 'email', id: user.emails[0] };

        var subject = 'Unknown method';
        switch (method) {
          case 'REQUEST':
            subject = i18n.__('New event from %s', userDisplayName(organizer));
            break;
          case 'REPLY':
            subject = i18n.__('An event has been updated from %s', userDisplayName(organizer));
            break;
          case 'CANCEL':
            subject = i18n.__('An event has been canceled from %s', userDisplayName(organizer));
            break;
        }

        var message = {
          subject: subject,
          alternatives: [{
            content: ics,
            contentType: 'text/calendar; charset=UTF-8; method=' + method,
            contentEncoding: 'base64'
          }],
          attachments: [{
            filename: 'invite.ics',
            content: ics,
            contentType: 'application/ics'
          }]
        };
        var options = {
          template: MAIL_TEMPLATE,
          message: message
        };

        var event = jcal2content(ics, baseUrl);
        var content = {
          baseUrl: baseUrl,
          event: event
        };

        return contentSender.send(from, to, content, options, 'email');
      });

      return q.all(sendMailToAllAttendees);

    }).nodeify(callback);
  });
}

module.exports = function(dependencies) {
  eventMessage = require('./../../../lib/message/eventmessage.core')(dependencies);
  i18n = require('../../../lib/i18n')(dependencies);
  userModule = dependencies('user');
  collaborationModule = dependencies('collaboration');
  messageHelpers = dependencies('helpers').message;
  arrayHelpers = dependencies('helpers').array;
  activityStreamHelper = dependencies('activitystreams').helpers;
  localpubsub = dependencies('pubsub').local;
  globalpubsub = dependencies('pubsub').global;
  collaborationPermission = dependencies('collaboration').permission;
  contentSender = dependencies('content-sender'),
  esnconfig = dependencies('esn-config'),
  staticConfig = dependencies('config')('default');

  return {
    dispatch: dispatch,
    inviteAttendees: inviteAttendees
  };
};
