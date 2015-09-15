'use strict';

angular.module('esn.calendar')
  .directive('eventQuickFormWizard', function(WidgetWizard, $rootScope) {
    function link($scope, element) {
      $scope.wizard = new WidgetWizard([
        '/calendar/views/event-quick-form/event-quick-form-wizard-step-0'
      ]);
    }
    return {
      restrict: 'E',
      templateUrl: '/calendar/views/event-quick-form/event-quick-form-wizard',
      scope: {
        user: '=',
        domain: '=',
        createModal: '=',
        event: '='
      },
      link: link
    };
  })

  .directive('eventCreateButton', function() {
    return {
      restrict: 'E',
      replace: true,
      scope: {
        community: '=',
        user: '='
      },
      templateUrl: '/calendar/views/event-quick-form/event-create-button.html'
    };
  })

  .directive('eventQuickForm', function($location, $timeout) {
    function link($scope, element, attrs, controller) {
      controller.initFormData();

      $scope.closeModal = function() {
        $scope.createModal.hide();
      };

      $scope.isNew = controller.isNew;
      $scope.deleteEvent = controller.deleteEvent;
      $scope.submit = $scope.isNew($scope.editedEvent) ? controller.addNewEvent : controller.modifyEvent;
      $scope.changeParticipation = controller.changeParticipation;
      $scope.resetEvent = controller.resetEvent;

      $scope.goToFullForm = function() {
        $scope.closeModal();
        $location.path('/calendar/event-full-form');
      };

      $timeout(function() {
        element.find('.title')[0].focus();
      }, 0);

      $scope.focusSubmitButton = function() {
        $timeout(function() {
          element.find('button[type="submit"]').focus();
        });
      };
    }

    return {
      restrict: 'E',
      replace: true,
      controller: 'eventFormController',
      templateUrl: '/calendar/views/event-quick-form/event-quick-form.html',
      link: link
    };
  });
