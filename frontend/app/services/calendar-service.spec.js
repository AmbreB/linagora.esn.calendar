'use strict';

/* global chai, sinon: false */

var expect = chai.expect;

describe('The calendarService service', function() {
  var CalendarCollectionShellMock,
    CalendarCollectionShellFuncMock,
    CalendarRightShellMock,
    self,
    CalendarRightShellResult;

  beforeEach(function() {
    self = this;

    CalendarCollectionShellMock = function() {
      return CalendarCollectionShellFuncMock.apply(this, arguments);
    };

    CalendarRightShellResult = {};
    CalendarRightShellMock = sinon.stub().returns(CalendarRightShellResult);

    angular.mock.module('esn.calendar');
    angular.mock.module(function($provide) {
      $provide.value('CalendarCollectionShell', CalendarCollectionShellMock);
      $provide.value('CalendarRightShell', CalendarRightShellMock);
    });
  });

  beforeEach(angular.mock.inject(function(calendarService, $httpBackend, $rootScope, calendarAPI, CALENDAR_EVENTS, DEFAULT_CALENDAR_ID) {
    this.$httpBackend = $httpBackend;
    this.$rootScope = $rootScope;
    this.calendarService = calendarService;
    this.calendarAPI = calendarAPI;
    this.CALENDAR_EVENTS = CALENDAR_EVENTS;
    this.DEFAULT_CALENDAR_ID = DEFAULT_CALENDAR_ID;
  }));

  describe('The listCalendars fn', function() {
    var response;

    beforeEach(function() {
      response = {
        _links: {
          self: {
            href: '/calendars/56698ca29e4cf21f66800def.json'
          }
        },
        _embedded: {
          'dav:calendar': [
            {
              _links: {
                self: {
                  href: '/calendars/56698ca29e4cf21f66800def/events.json'
                }
              },
              'dav:name': null,
              'caldav:description': null,
              'calendarserver:ctag': 'http://sabre.io/ns/sync/3',
              'apple:color': null,
              'apple:order': null
            }
          ]
        }
      };
    });

    it('should call calendarService.listCalendars with options', function() {
      var options = {
        withRights: true
      };

      this.calendarAPI.listCalendars = sinon.spy(function() {
        return $q.when();
      });

      this.calendarService.listCalendars('homeId', options);

      expect(self.calendarAPI.listCalendars).to.be.calledWith('homeId', options);
    });

    it('should call not cache the calls calendarService.listCalendars when there are options', function() {
      var options = {
        withRights: true
      };

      this.calendarAPI.listCalendars = sinon.spy(function() {
        return $q.when([]);
      });

      this.calendarService.listCalendars('homeId', options).then(function() {
        self.calendarService.listCalendars('homeId', options).then(function() {
          expect(self.calendarAPI.listCalendars).to.have.been.called.twice;
        });
      });
      this.$rootScope.$digest();
    });

    it('should wrap each received dav:calendar in a CalendarCollectionShell', function(done) {
      var calendarCollection = {id: this.DEFAULT_CALENDAR_ID};

      CalendarCollectionShellFuncMock = sinon.spy(function(davCal) {
        expect(davCal).to.deep.equal(response._embedded['dav:calendar'][0]);

        return calendarCollection;
      });

      this.$httpBackend.expectGET('/dav/api/calendars/homeId.json').respond(response);

      this.calendarService.listCalendars('homeId').then(function(calendars) {
        expect(calendars).to.have.length(1);
        expect(calendars[0]).to.equal(calendarCollection);
        expect(CalendarCollectionShellFuncMock).to.have.been.called;
        done();
      });

      this.$httpBackend.flush();
    });

    it('should cache calendars', function() {
      CalendarCollectionShellFuncMock = angular.identity;

      this.$httpBackend.expectGET('/dav/api/calendars/homeId.json').respond(response);

      this.calendarService.listCalendars('homeId').then(function(calendars) {
        self.calendarService.listCalendars('homeId').then(function(calendars2) {
          expect(calendars).to.equal(calendars2);
        });
      });

      this.$httpBackend.flush();
    });
  });

  describe('listAllCalendarsForUser', function() {
    var allCalendars;

    beforeEach(function() {
      sinon.stub(this.calendarAPI, 'listAllCalendars', function() {
        return allCalendars;
      });
    });

    it('should leverage calendarAPI.listAllCalendars', function(done) {
      allCalendars = $q.when([]);

      this.calendarService.listAllCalendarsForUser().then(function() {
        expect(self.calendarAPI.listAllCalendars).to.have.been.called;

        done();
      });

      this.$rootScope.$digest();
    });

    it('should filter user calaendars and returns only their _embedded["dav:calendar"]', function(done) {
      var userId = 'userId';
      var calendars = [
        {
          _links: {
            self: {
              href: '/calendars/' + userId + '.json'
            }
          },
          _embedded: {
            'dav:calendar': [
              {
                _links: {
                  self: {
                    href: '/calendars/' + userId + '/events.json'
                  }
                },
                'caldav:description': 'userId'
              }
            ]
          }
        },
        {
          _links: {
            self: {
              href: '/calendars/56698ca29e4cf21f66800def.json'
            }
          },
          _embedded: {
            'dav:calendar': [
              {
                _links: {
                  self: {
                    href: '/calendars/56698ca29e4cf21f66800def/events.json'
                  }
                },
                'caldav:description': '56698ca29e4cf21f66800def'
              }
            ]
          }
        }
      ];
      allCalendars = $q.when(calendars);

      CalendarCollectionShellFuncMock = sinon.spy(function(davCal) {
        expect(davCal).to.deep.equal(calendars[0]._embedded['dav:calendar'][0]);
      });

      this.calendarService.listAllCalendarsForUser(userId)
        .then(function() {
          expect(self.calendarAPI.listAllCalendars).to.have.been.called;
          expect(CalendarCollectionShellFuncMock).to.have.been.called;

          done();
        });

      this.$rootScope.$digest();
    });
  });

  describe('The get calendar fn', function() {
    it('should wrap the received dav:calendar in a CalendarCollectionShell', function(done) {

      var response = {
        _links: {
          self: {
            href: '/calendars/56698ca29e4cf21f66800def/events.json'
          }
        },
        'dav:name': null,
        'caldav:description': null,
        'calendarserver:ctag': 'http://sabre.io/ns/sync/3',
        'apple:color': null,
        'apple:order': null
      };

      var calendarCollection = {};

      CalendarCollectionShellFuncMock = sinon.spy(function(davCal) {
        expect(davCal).to.deep.equal(response);

        return calendarCollection;
      });

      this.$httpBackend.expectGET('/dav/api/calendars/homeId/id.json').respond(response);

      this.calendarService.getCalendar('homeId', 'id').then(function(calendar) {
        expect(calendar).to.equal(calendarCollection);
        expect(CalendarCollectionShellFuncMock).to.have.been.called;
        done();
      });

      this.$httpBackend.flush();
    });
  });

  describe('The get right calendar fn', function() {
    it('should wrap the returning server response in  a CalendarRightShell', function() {
      var calendar = {id: 'calId'};

      var body = {
        acl: 'acl',
        invite: 'invite'
      };

      this.$httpBackend.expect('PROPFIND', '/dav/api/calendars/homeId/calId.json', {
        prop: ['cs:invite', 'acl']
      }).respond(200, body);

      var thenSpy = sinon.spy();

      this.calendarService.getRight('homeId', calendar).then(thenSpy);
      this.$httpBackend.flush();
      expect(thenSpy).to.have.been.calledWith(sinon.match.same(CalendarRightShellResult));
      expect(CalendarRightShellMock).to.have.been.calledWith(body.acl, body.invite);
    });
  });

  describe('The remove calendar fn', function() {
    it('should send a delete request to the correct URL', function() {
      this.$httpBackend.expectDELETE('/dav/api/calendars/homeId/cal.json').respond(204, 'response');

      var promiseSpy = sinon.spy();

      this.calendarService.removeCalendar('homeId', {id: 'cal'}).then(promiseSpy);

      this.$httpBackend.flush();
      this.$rootScope.$digest();

      expect(promiseSpy).to.have.been.calledWith(sinon.match({data: 'response'}));
    });

    it('should sync cache of list calendars', function() {
      CalendarCollectionShellFuncMock = angular.identity;

      this.$httpBackend.expectGET('/dav/api/calendars/homeId.json').respond({_embedded: {
        'dav:calendar': [{id: 1}, {id: 2}]
      }});

      this.$httpBackend.expectDELETE('/dav/api/calendars/homeId/2.json').respond(204, 'response');

      var thenSpy = sinon.spy();
      this.calendarService.listCalendars('homeId').then(function() {
        self.calendarService.removeCalendar('homeId', {id: 2}).then(function() {
          self.calendarService.listCalendars('homeId').then(thenSpy);
        });
      });

      this.$httpBackend.flush();
      this.$rootScope.$digest();
      expect(thenSpy).to.have.been.calledWith(sinon.match({
        length: 1,
        0: {id: 1}
      }));
    });

    it('should broadcast a CALENDARS.REMOVE event when the calendar has been created', function() {
      var calendar = {id: 'calId'};

      this.$httpBackend.expectDELETE('/dav/api/calendars/homeId/calId.json').respond(204, 'response');
      this.$rootScope.$broadcast = sinon.stub().returns({});
      this.calendarService.removeCalendar('homeId', calendar);

      this.$httpBackend.flush();
      this.$rootScope.$digest();

      expect(self.$rootScope.$broadcast).to.have.been.calledWith(this.CALENDAR_EVENTS.CALENDARS.REMOVE, calendar);
    });
  });

  describe('The create calendar fn', function() {
    it('should send a post request to the correct URL', function() {
      var calendar = {id: 'calId'};

      CalendarCollectionShellMock.toDavCalendar = sinon.spy(angular.identity);

      this.$httpBackend.expectPOST('/dav/api/calendars/homeId.json').respond(201, {});

      var promiseSpy = sinon.spy();

      this.calendarService.createCalendar('homeId', calendar).then(promiseSpy);

      this.$httpBackend.flush();
      this.$rootScope.$digest();

      expect(promiseSpy).to.have.been.calledWith(calendar);
      expect(CalendarCollectionShellMock.toDavCalendar).to.have.been.calledWith(calendar);
    });

    it('should sync cache of list calendars', function(done) {
      CalendarCollectionShellFuncMock = angular.identity;

      this.$httpBackend.expectGET('/dav/api/calendars/homeId.json').respond({_embedded: {
        'dav:calendar': [{id: 1}, {id: 2}]
      }});
      this.$httpBackend.expectPOST('/dav/api/calendars/homeId.json').respond(201, {});

      this.calendarService.listCalendars('homeId').then(function() {
        var calendar = {id: 'calId'};

        CalendarCollectionShellMock.toDavCalendar = angular.identity;
        self.calendarService.createCalendar('homeId', calendar).then(function() {
          self.calendarService.listCalendars('homeId').then(function(calendar) {
            expect(calendar).to.shallowDeepEqual({
              length: 3,
              2: {id: 'calId'}
            });
            done();
          });
        });
      });

      this.$httpBackend.flush();
      this.$rootScope.$digest();
    });

    it('should broadcast a CALENDARS.ADD event when the calendar has been created', function() {
      var calendar = {id: 'calId'};

      CalendarCollectionShellMock.toDavCalendar = sinon.spy(angular.identity);

      this.$httpBackend.expectPOST('/dav/api/calendars/homeId.json').respond(201, {});

      this.$rootScope.$broadcast = sinon.spy(angular.identity);

      this.calendarService.createCalendar('homeId', calendar).then(function() {});

      this.$httpBackend.flush();
      this.$rootScope.$digest();

      expect(self.$rootScope.$broadcast).to.have.been.calledWith(this.CALENDAR_EVENTS.CALENDARS.ADD, calendar);
    });
  });

  describe('The modify calendar fn', function() {
    it('should send a put request to the correct URL and return resulting calendar', function() {
      var calendar = {id: 'calId'};

      CalendarCollectionShellMock.toDavCalendar = sinon.spy(angular.identity);

      this.$httpBackend.expect('PROPPATCH', '/dav/api/calendars/homeId/calId.json').respond(204, {});

      var promiseSpy = sinon.spy();

      this.calendarService.modifyCalendar('homeId', calendar).then(promiseSpy);

      this.$httpBackend.flush();
      this.$rootScope.$digest();

      expect(promiseSpy).to.have.been.calledWith(calendar);
      expect(CalendarCollectionShellMock.toDavCalendar).to.have.been.calledWith(calendar);
    });

    it('should sync cache of list calendars', function(done) {
      CalendarCollectionShellFuncMock = angular.identity;

      this.$httpBackend.expectGET('/dav/api/calendars/homeId.json').respond({_embedded: {
        'dav:calendar': [{id: 1}, {id: 'events', selected: true}]
      }});
      this.$httpBackend.expect('PROPPATCH', '/dav/api/calendars/homeId/events.json').respond(204, {});

      this.calendarService.listCalendars('homeId').then(function() {
        var calendar = {id: 'events', name: 'modified cal'};

        CalendarCollectionShellMock.toDavCalendar = angular.identity;
        self.calendarService.modifyCalendar('homeId', calendar).then(function() {
          self.calendarService.listCalendars('homeId').then(function(calendar) {
            expect(calendar).to.shallowDeepEqual({
              length: 2,
              1: {id: 'events', name: 'modified cal', selected: true}
            });
            done();
          });
        });
      });

      this.$httpBackend.flush();
      this.$rootScope.$digest();
    });
  });

  describe('The modify rights fn', function() {
    it('should compute sharee dav diff and send it to sabre', function() {
      var davDiff = 'davDiff';
      var newCalendarShell = {
        toDAVShareRightsUpdate: sinon.stub().returns(davDiff)
      };
      var oldCalendarShell = {};

      this.calendarService.modifyRights('homeId', {id: 'calId'}, newCalendarShell, oldCalendarShell);

      expect(newCalendarShell.toDAVShareRightsUpdate).to.have.been.calledWith(sinon.match.same(oldCalendarShell));
      this.$httpBackend.expect('POST', '/dav/api/calendars/homeId/calId.json', davDiff).respond(200, {});
      this.$httpBackend.flush();
    });
  });

});
