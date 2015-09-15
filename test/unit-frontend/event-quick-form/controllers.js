'use strict';

/* global chai: false */
/* global sinon: false */

var expect = chai.expect;

describe('The event-quick-form module controllers', function() {
  var event;

  beforeEach(function() {
    event = {};

    var calendarUtilsMock = {
      getNewStartDate: function() {
        return moment('2013-02-08 09:30'); // jshint ignore:line
      },
      getNewEndDate: function() {
        return moment('2013-02-08 10:30'); // jshint ignore:line
      }
    };

    this.calendarServiceMock = {
      calendarId: '1234',
      shellToICAL: function(e) {
        event = e;
      },
      create: function() {
        return $q.when({});
      },
      icalToShell: function(event) {
        return event;
      },
      modify: function(path , e) {
        event = e;
        return $q.when();
      }
    };

    var sessionMock = {
      user: {
        firstname: 'first',
        lastname: 'last',
        emails: ['user@test.com'],
        emailMap: { 'user@test.com': true }
      }
    };

    this.uiCalendarConfig = {
      calendars: {
        calendarId: {
          fullCalendar: function() {
          },
          offset: function() {
            return {
              top: 1
            };
          }
        }
      }
    };

    this.notificationFactory = {
      weakInfo: sinon.spy(),
      weakError: sinon.spy()
    };
    this.gracePeriodService = {};

    var self = this;
    angular.mock.module('esn.calendar');
    angular.mock.module('ui.calendar', function($provide) {
      $provide.constant('uiCalendarConfig', self.uiCalendarConfig);
    });
    angular.mock.module(function($provide) {
      $provide.decorator('calendarUtils', function($delegate) {
        return angular.extend($delegate, calendarUtilsMock);
      });
      $provide.value('calendarService', self.calendarServiceMock);
      $provide.value('session', sessionMock);
      $provide.value('notificationFactory', self.notificationFactory);
      $provide.value('gracePeriodService', self.gracePeriodService);
    });
  });

  beforeEach(angular.mock.inject(function($controller, $rootScope, moment, eventService) {
    this.rootScope = $rootScope;
    this.scope = $rootScope.$new();
    this.controller = $controller;
    this.moment = moment;
    this.eventService = eventService;
  }));

  describe('The eventFormController controller', function() {

    beforeEach(function() {
      this.eventFormController = this.controller('eventFormController', {
        $rootScope: this.rootScope,
        $scope: this.scope
      });
    });

    describe('initFormData function', function() {
      it('should initialize the scope with a default event if $scope.event does not exist', function() {
        this.eventFormController.initFormData();
        var expected = {
          start: this.moment('2013-02-08 09:30'),
          end: this.moment('2013-02-08 10:30'),
          allDay: false
        };
        expect(this.scope.editedEvent).to.deep.equal(expected);
        expect(this.scope.event).to.deep.equal(expected);
      });

      it('should initialize the scope with $scope.event if it exists', function() {
        this.scope.event = {
          _id: '123456',
          start: this.moment('2013-02-08 12:30'),
          end: this.moment('2013-02-08 13:30'),
          allDay: false,
          otherProperty: 'aString'
        };
        this.eventFormController.initFormData();
        expect(this.scope.editedEvent).to.deep.equal(this.scope.event);
      });

      it('should detect if organizer', function() {
        this.scope.event = {
          _id: '123456',
          start: this.moment('2013-02-08 12:30'),
          end: this.moment('2013-02-08 13:30'),
          allDay: false,
          organizer: {
            email: 'user@test.com'
          },
          otherProperty: 'aString'
        };
        this.eventFormController.initFormData();
        expect(this.scope.isOrganizer).to.equal(true);
      });

      it('should detect if not organizer', function() {
        this.scope.event = {
          _id: '123456',
          start: this.moment('2013-02-08 12:30'),
          end: this.moment('2013-02-08 13:30'),
          organizer: {
            email: 'other@test.com'
          },
          otherProperty: 'aString'
        };
        this.eventFormController.initFormData();
        expect(this.scope.isOrganizer).to.equal(false);
      });
    });

    describe('modifyEvent function', function() {
      beforeEach(function() {
        this.eventService.isMajorModification = function() {};
      });

      describe('as an organizer', function() {
        beforeEach(function() {
          this.scope.isOrganizer = true;
        });
        it('should display an error if the edited event has no title', function(done) {
          var $alertMock = function(alertObject) {
            expect(alertObject.show).to.be.true;
            expect(alertObject.content).to.equal('You must define an event title');
            done();
          };
          this.eventFormController = this.controller('eventFormController', {
            $rootScope: this.rootScope,
            $scope: this.scope,
            $alert: $alertMock
          });

          this.scope.editedEvent = {};
          this.eventFormController.modifyEvent();
        });

        it('should not send modify request if no change', function(done) {
          this.scope.createModal = {
            hide: function() {
              done();
            }
          };
          this.eventFormController = this.controller('eventFormController', {
            $rootScope: this.rootScope,
            $scope: this.scope
          });

          this.scope.event = {
            startDate: new Date(),
            endDate: new Date(),
            allDay: false,
            title: 'title'
          };
          this.scope.editedEvent = this.scope.event;
          this.eventFormController.modifyEvent();
        });

        it('should not send modify request if properties not visible in the UI changed', function(done) {
          this.scope.createModal = {
            hide: function() {
              expect(event.diff).to.equal(123123);
              expect(editedEvent.diff).to.equal(234234);
              done();
            }
          };
          this.eventFormController = this.controller('eventFormController', {
            $rootScope: this.rootScope,
            $scope: this.scope
          });

          var event = this.scope.event = {
            startDate: new Date(),
            endDate: new Date(),
            allDay: false,
            title: 'title',
            diff: 123123
          };
          var editedEvent = this.scope.editedEvent = angular.copy(event);
          this.scope.editedEvent.diff = 234234;
          this.eventFormController.modifyEvent();
        });

        it('should add newAttendees', function() {
          this.scope.event = {
            title: 'oldtitle',
            path: '/path/to/event',
            attendees: ['user1@test.com']
          };
          this.scope.editedEvent = {
            title: 'title',
            attendees: ['user1@test.com']
          };
          this.scope.newAttendees = ['user2@test.com', 'user3@test.com'];
          this.eventFormController.modifyEvent();
          expect(event).to.deep.equal({
            title: 'title',
            attendees: ['user1@test.com', 'user2@test.com', 'user3@test.com']
          });
        });

        it('should pass along the etag', function() {
          this.scope.event = {
            title: 'oldtitle',
            path: '/path/to/event',
            etag: '123123'
          };

          this.scope.editedEvent = {
            title: 'title',
            path: '/path/to/event',
            etag: '123123'
          };

          this.calendarServiceMock.modify = sinon.spy(function(path, event, oldEvent, etag) {
            expect(event.title).to.equal('title');
            expect(oldEvent.title).to.equal('oldtitle');
            expect(path).to.equal('/path/to/event');
            expect(etag).to.equal('123123');
            return $q.when();
          });

          this.eventFormController.modifyEvent();

          this.scope.$digest();
          expect(this.calendarServiceMock.modify).to.have.been.called;
        });
      });

      describe('as an attendee', function() {
        beforeEach(function() {
          this.scope.isOrganizer = false;
        });

        it('should changeParticipation with ACCEPTED', function(done) {
          var status = null;
          var self = this;

          this.scope.invitedAttendee = {
            partstat: 'ACCEPTED'
          };

          this.calendarServiceMock.changeParticipation = function(path, event, emails, _status_) {
            status = _status_;
            return $q.when({});
          };
          this.scope.createModal = {
            hide: function() {
              expect(status).to.equal('ACCEPTED');
              expect(self.notificationFactory.weakInfo).to.have.been.called;
              done();
            }
          };
          this.eventFormController = this.controller('eventFormController', {
            $rootScope: this.rootScope,
            $scope: this.scope
          });
          this.eventFormController.modifyEvent();
          this.scope.$digest();
        });

        it('should no displayNotification if response is null', function(done) {
          var status = null;
          var self = this;

          this.scope.invitedAttendee = {
            partstat: 'DECLINED'
          };
          this.calendarServiceMock.changeParticipation = function(path, event, emails, _status_) {
            status = _status_;
            return $q.when(null);
          };
          this.scope.createModal = {
            hide: function() {
              expect(status).to.equal('DECLINED');
              expect(self.notificationFactory.weakInfo).to.have.not.been.called;
              done();
            }
          };
          this.eventFormController = this.controller('eventFormController', {
            $rootScope: this.rootScope,
            $scope: this.scope
          });
          this.eventFormController.modifyEvent();
          this.scope.$digest();
        });
      });
    });

    describe('addNewEvent function', function() {
      it('should force title to \'No title\' if the edited event has no title', function() {
        this.scope.editedEvent = {};
        this.eventFormController.addNewEvent();
        expect(this.scope.editedEvent.title).to.equal('No title');
      });

      it('should add newAttendees from the form', function() {
        this.scope.editedEvent = {};
        this.scope.newAttendees = ['user1@test.com', 'user2@test.com'];
        this.eventFormController.addNewEvent();
        expect(event).to.deep.equal({
          title: 'No title',
          attendees: ['user1@test.com', 'user2@test.com'],
          organizer: {
            displayName: 'first last',
            emails: ['user@test.com']
          }
        });
      });
    });
  });
});
