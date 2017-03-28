(function() {
  'use strict';

  angular.module('esn.calendar')
    .controller('CalendarsListController', CalendarsListController);

  function CalendarsListController(
    $rootScope,
    $scope,
    $q,
    calendarService,
    calendarVisibilityService,
    session,
    userAndExternalCalendars,
    calPublicCalendarStore,
    _,
    CALENDAR_EVENTS
  ) {
    var self = this;

    self.$onInit = $onInit;
    self.activate = activate;

    ////////////

    function $onInit() {
      self.calendars = [];
      self.userCalendars = [];
      self.publicCalendars = [];
      self.sharedCalendars = [];
      self.hiddenCalendars = {};
      self.toggleCalendar = calendarVisibilityService.toggle;

      self.activate();
    }

    function activate() {
      $q
        .all(listCalendars(), getHiddenCalendars())
        .then(function() {
          var destroyCalAddEvent = $rootScope.$on(CALENDAR_EVENTS.CALENDARS.ADD, handleCalendarAdd);
          var destroyCalRemoveEvent = $rootScope.$on(CALENDAR_EVENTS.CALENDARS.REMOVE, handleCalendarRemove);
          var destroyCalUpdateEvent = $rootScope.$on(CALENDAR_EVENTS.CALENDARS.UPDATE, handleCalendarUpdate);

          var deregister = $rootScope.$on(CALENDAR_EVENTS.CALENDARS.TOGGLE_VIEW, function(event, data) {
            self.hiddenCalendars[data.calendarId] = data.hidden;
          });

          $scope.$on('$destroy', destroyCalAddEvent);
          $scope.$on('$destroy', destroyCalRemoveEvent);
          $scope.$on('$destroy', destroyCalUpdateEvent);
          $scope.$on('$destroy', deregister);
        });
    }

    function listCalendars() {
      var options = {
        withRights: true
      };

      return calendarService.listCalendars(session.user._id, options).then(function(calendars) {
        self.calendars = _.clone(calendars);
        self.calendars = self.calendars.concat(calPublicCalendarStore.getAll());

        refreshCalendarsList();
      });
    }

    function getHiddenCalendars() {
      return calendarVisibilityService.getHiddenCalendars().then(function(hiddenCalendars) {
        hiddenCalendars.forEach(function(calendarId) {
          self.hiddenCalendars[calendarId] = true;
        });
      });
    }

    function handleCalendarAdd(event, calendar) {
      if (!_.find(self.calendars, {id: calendar.id})) {
        self.calendars.push(calendar);

        refreshCalendarsList();
      }
    }

    function handleCalendarUpdate(event, calendar) {
      var index = _.findIndex(self.calendars, { id: calendar.id });

      if (index > -1) {
        self.calendars[index] = calendar;

        refreshCalendarsList();
      }
    }

    function handleCalendarRemove(event, calendar) {
      _.remove(self.calendars, { id: calendar.id });

      refreshCalendarsList();
    }

    function refreshCalendarsList() {
      var calendars = userAndExternalCalendars(self.calendars);

      self.userCalendars = calendars.userCalendars;
      self.sharedCalendars = calendars.sharedCalendars;
      self.publicCalendars = calendars.publicCalendars;
    }
  }
})();
