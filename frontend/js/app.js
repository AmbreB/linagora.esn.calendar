'use strict';

angular.module('esn.calendar', [
  'esn.core',
  'esn.authentication',
  'esn.ical',
  'esn.community',
  'restangular',
  'mgcrea.ngStrap.datepicker',
  'mgcrea.ngStrap.aside',
  'angularMoment',
  'AngularJstz',
  'esn.notification',
  'esn.widget.helper',
  'uuid4',
  'ui.calendar',
  'ng.deviceDetector'
])
  .config(function($routeProvider, routeResolver) {

    $routeProvider.when('/calendar/communities/:community_id', {
      templateUrl: '/calendar/views/calendar/community-calendar',
      controller: 'communityCalendarController',
      resolve: {
        community: routeResolver.api('communityAPI', 'get', 'community_id', '/communities')
      }
    });

    $routeProvider.when('/calendar/event-full-form', {
      templateUrl: '/calendar/views/event-full-form/event-full-form-view'
    });

    $routeProvider.when('/calendar', {
      templateUrl: '/calendar/views/calendar/user-calendar',
      controller: 'userCalendarController',
      resolve: {
        user: routeResolver.session('user')
      }
    });

  });
