'use strict';

var expect = require('chai').expect;
var fs = require('fs-extra');
var icaljs = require('ical.js');

describe.skip('jcalHelper', function() {

  beforeEach(function() {
    this.calendarModulePath = this.moduleHelpers.modulesPath + 'linagora.esn.calendar';
    this.jcalHelper = require(this.calendarModulePath + '/backend/lib/jcal/jcalHelper');
  });

  describe('the getAttendeesEmails function', function() {
    it('should return an empty array if the ical component has no attendee', function() {
      var ics = fs.readFileSync(this.calendarModulePath + '/test/unit-backend/fixtures/noAttendee.ics').toString('utf8');
      var vcalendar = icaljs.Component.fromString(ics).toJSON();
      expect(this.jcalHelper.getAttendeesEmails(vcalendar)).to.deep.equal([]);
    });

    it('should get the attendees emails from the ical component', function() {
      var ics = fs.readFileSync(this.calendarModulePath + '/test/unit-backend/fixtures/meeting.ics').toString('utf8');
      var vcalendar = icaljs.Component.fromString(ics).toJSON();
      expect(this.jcalHelper.getAttendeesEmails(vcalendar)).to.deep.equal(['johndoe@open-paas.org', 'janedoe@open-paas.org']);
    });
  });

  describe('jcal2content function', function() {
    var ics;

    it('should parse jcal formatted event and return a pruned content for the email', function() {
      ics = fs.readFileSync(this.calendarModulePath + '/test/unit-backend/fixtures/meeting.ics').toString('utf8');
      expect(this.jcalHelper.jcal2content(ics, 'http://localhost:8080/')).to.deep.equal({
        method: 'REQUEST',
        sequence: 0,
        summary: 'Démo OPENPAAS',
        start: {
          date: '06/12/2015',
          time: '3:00 PM'
        },
        end: {
          date: '06/12/2015',
          time: '3:30 PM'
        },
        location: 'https://hubl.in/openpaas',
        description: 'Présentation de OPENPAAS',
        organizer: {
          cn: 'John Doe',
          email: 'johndoe@open-paas.org',
          avatar: 'http://localhost:8080/api/avatars?objectType=user&email=johndoe@open-paas.org'
        },
        attendees: {
          'johndoe@open-paas.org': {
            cn: 'John Doe',
            partstat: 'ACCEPTED'
          },
          'janedoe@open-paas.org': {
            cn: 'Jane Doe',
            partstat: 'NEEDS-ACTION'
          }
        }
      });
    });

    it('should parse jcal formatted event without end date nor duration', function() {
      ics = fs.readFileSync(this.calendarModulePath + '/test/unit-backend/fixtures/cancel-event.ics').toString('utf8');
      expect(this.jcalHelper.jcal2content(ics, 'http://localhost:8080/')).to.deep.equal({
        method: 'CANCEL',
        sequence: 0,
        summary: 'Démo OPENPAAS',
        start: {
          date: '06/12/2015',
          time: '3:00 PM'
        },
        end: null,
        location: 'https://hubl.in/openpaas',
        description: 'Présentation de OPENPAAS',
        organizer: {
          cn: 'John Doe',
          email: 'johndoe@open-paas.org',
          avatar: 'http://localhost:8080/api/avatars?objectType=user&email=johndoe@open-paas.org'
        },
        attendees: {
          'johndoe@open-paas.org': {
            cn: 'John Doe',
            partstat: 'ACCEPTED'
          },
          'janedoe@open-paas.org': {
            cn: 'Jane Doe',
            partstat: 'NEEDS-ACTION'
          }
        }
      });
    });
  });

});
