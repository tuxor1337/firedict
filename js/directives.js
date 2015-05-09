/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

var FireDictDirectives = angular.module("FireDictDirectives", ["FireDictProvider"])
.directive("ngHeader", function ($timeout) {
    return {
        replace: true,
        restrict: "A",
        scope: {
            "onFocus": '=focus',
            "searchTerm": '=term',
            "toggleSidebar": '=toggle',
            "onReindex": '=reindex',
            "onAdd": '=addButton',
            "onEnter": '=enter',
            "onGroupButton": '=groups',
            "text": '@text'
        },
        link: function ($scope, $element, $attrs) {
            $scope.type = $attrs.type;
            $scope.onClear = function (e) {
                $scope.searchTerm = "";
                $timeout(function() {
                  $element.find("form input").focus();
                });
            };
            $element.find("form input").bind("keydown keypress",
                function (e) {
                    if(e.which === 13) {
                        $scope.onEnter(e);
                        e.preventDefault();
                    }
                }
            );
        },
        templateUrl: "partials/header.html"
    };
})
.directive("ngWordpicker", ["$rootScope", "dictProvider", "ngDialog",
    function ($rootScope, dictProvider, ngDialog) {
        return {
            replace: true,
            restrict: "A",
            scope: {
                "markup": '=markup',
                "picked": '='
            },
            link: function ($scope, $element, $attrs) {
                var content = $element.find("div.content")[0];
                $scope.$watch(
                function () { return $(content).find(".picked").text(); },
                function (value) {
                    $scope.picked = value
                    .replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*$/,'')
                    .replace(/^[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*/,'');
                });
                $scope.pick_word = function ($event) {
                    wordpicker_wrap($event.originalEvent);
                };
            },
            templateUrl: "partials/wordpicker.html"
        };
}])
.directive("ngGrouppicker", ["$rootScope", "dictProvider", "ngDialog",
    function ($rootScope, dictProvider, ngDialog) {
        return {
            replace: true,
            restrict: "A",
            link: function ($scope, $element, $attrs) {
                $scope.selectable = $attrs.selectable;
                $scope.selected = -1;
                $scope.dictColor = $rootScope.dictColor;
                $scope.groups = dictProvider.groups;
                $scope.dictionaries = dictProvider.dictionaries;
                $scope.select = function (group) {
                    if($scope.selectable) {
                        if($scope.selected == group) $scope.selected = -1;
                        else $scope.selected = group;
                    }
                };
                $scope.isSelected = function (group) {
                    return ($scope.selected === group)? "selected" : "";
                }
                $scope.groupDictFilter = function (group) {
                    return function (dict) {
                        return dictProvider.groups.members(group).indexOf(dict.version) >= 0;
                    };
                };
                $scope.all_active = function (bol) {
                    var aDicts = dictProvider.dictionaries();
                    function is_active() {
                        var result = 0;
                        aDicts.forEach(function (dict) {
                            if(dict.active) result += 1;
                        });
                        if(result == 0) return "inactive";
                        if(result < aDicts.length) return "";
                        return "active";
                    }
                    var target = false;
                    if(typeof bol === "undefined") return is_active();
                    else {
                        if(is_active() === "inactive") target = true;
                        aDicts.forEach(function (dict) { dict.active = target; });
                    }
                };
                $scope.remove = function (group) {
                    ngDialog.open({
                        l20n: {
                            text: "dialog-remove-group",
                            success: "dialog-yes-sure",
                            cancel: "dialog-no-forget-it"
                        },
                        value: group,
                        callbk: function (result) {
                            if(result === true) dictProvider.groups.remove_group(group);
                        }
                    });
                };
                $scope.rename = function (group) {
                    ngDialog.open({
                        type: "prompt",
                        l20n: {
                            text: "dialog-rename-group"
                        },
                        value: group,
                        callbk: function (alias) {
                            if(alias !== null) dictProvider.groups.rename_group(group, alias);
                        },
                        validate: function (alias) { return alias != ""; }
                    });
                };
                $scope.setMembers = function (group) {
                    var aDicts = [];
                    dictProvider.dictionaries(true).forEach(function (dict) {
                        aDicts.push({
                            active: dictProvider.groups.is_member(group, dict.version),
                            name: dict.alias,
                            did: dict.version
                        });
                    });
                    ngDialog.open({
                        type: "group_membership",
                        l20n: {
                            text: "dialog-change-members"
                        },
                        value: aDicts,
                        callbk: function (dicts) {
                            if(dicts === null) return;
                            dicts.forEach(function (d) {
                                if(d.active) dictProvider.groups.add_to_group(group, d.did);
                                else dictProvider.groups.remove_from_group(group, d.did);
                            });
                        }
                    });
                };
            },
            templateUrl: "partials/grouppicker.html"
        };
}])
.directive("ngDrawer", function () {
    return {
        replace: true,
        transclude: true,
        restrict: "A",
        link: function ($scope, $element, $attrs) {
            $scope.title = $attrs.title;
            $scope.menuitems = [
                {
                    "route": "#/lookup",
                    "l10n": "section-lookup-words"
                },
                {
                    "route": "#/manage",
                    "l10n": "section-manage-dicts"
                },
                {
                    "route": "#/groups",
                    "l10n": "section-manage-groups"
                },
                {
                    "route": "#/settings",
                    "l10n": "section-settings"
                },
                {
                    "route": "#/about",
                    "l10n": "section-about"
                }
            ];
        },
        templateUrl: "partials/sidebar.html"
    };
})
.directive("ngSortable", function () {
    return {
        compile: function () {
            return function ($scope, $element, $attr) {
                var handle, startY, currIndex = -1, dragover = null;

                var moveAfter = $scope.$eval($attr.moveFn);

                function touchY(evt) {
                    return evt.originalEvent.changedTouches[0].pageY;
                }

                function getNext(curr, last) {
                    $(curr).siblings().css("transition", "border 0.5s");
                    var currRect = curr.getBoundingClientRect(),
                        lastRect = last.getBoundingClientRect(),
                        currMiddleY = 0.5*(currRect.bottom + currRect.top),
                        next = null;
                    if(currMiddleY < lastRect.top + 0.5*last.clientHeight) {
                        if(isFirst(curr, last)) {
                            next = last;
                            $(next).removeClass("insertAfter")
                                .addClass("insertBefore");
                        } else {
                            $(last).removeClass("insertAfter");
                            if($(last).index() == $(curr).index() + 1)
                                next = $(curr).prev()[0];
                            else next = $(last).prev()[0];
                            $(next).addClass("insertAfter");
                        }
                    } else {
                        var parentRect = $(curr).parent()[0].getBoundingClientRect();
                        if($(last).hasClass("insertBefore")) {
                            next = last;
                            $(next).removeClass("insertBefore")
                                .addClass("insertAfter");
                        } else if(isLast(curr, last)) {
                            next = last;
                        } else {
                            $(last).removeClass("insertAfter");
                            if($(last).index() == $(curr).index() - 1)
                                next = $(curr).next()[0];
                            else next = $(last).next()[0];
                            $(next).addClass("insertAfter");
                        }
                    }
                    return next;
                }

                function parentMiddleDistY(el) {
                    var parentRect = $(el).parent()[0].getBoundingClientRect(),
                        currRect = el.getBoundingClientRect();
                    return 0.5*(currRect.bottom + currRect.top) - parentRect.top;
                }

                function isContained(curr, testEl) {
                    var currRect = curr.getBoundingClientRect(),
                        testRect = testEl.getBoundingClientRect(),
                        currMiddleY = 0.5*(currRect.bottom + currRect.top);
                    if(isFirst(curr, testEl)) {
                        if(parentMiddleDistY(curr) <= 0) return true;
                        if($(testEl).hasClass("insertBefore")) {
                            return currMiddleY <= testRect.bottom - 0.5*testEl.clientHeight;
                        }
                    }
                    var parentRect = $(curr).parent()[0].getBoundingClientRect();
                    return (currMiddleY  >= testRect.top + 0.5*testEl.clientHeight
                        && currMiddleY <= testRect.bottom + 0.5*testEl.clientHeight)
                        || (currRect.bottom > parentRect.bottom && isLast(curr, testEl));
                }

                function isFirst(curr, testEl) {
                    return $(testEl).index() == 0
                        || ($(testEl).index() == 1 && $(curr).index() == 0);
                }

                function isLast(curr, testEl) {
                    var len = $(testEl).siblings().length,
                        result = $(testEl).index() == len
                        || ($(testEl).index() == len-1 && $(curr).index() == len);
                    return result;
                }

                $element
                .on("touchstart", "li[draggable]", function (e) {
                    if($(this).siblings().length > 0) {
                        handle = e.target;
                        startY = touchY(e);
                    }
                })
                .on("touchmove", "li[draggable]", function (e) {
                    if($(this).find(".handle").length == 0) return;
                    if($(this).find(".handle")[0].contains(handle)) {
                        e.preventDefault();
                        if(currIndex >= 0) {
                            $(this).css({ "top": touchY(e) - 20 + "px" });
                            if(dragover == null) {
                                if($(this).index() > 0)
                                    dragover = $(this).prev().addClass("insertAfter")[0];
                                else dragover = $(this).next().addClass("insertBefore")[0];
                            } else if (!isContained(this, dragover)) {
                                dragover = getNext(this, dragover);
                            }
                        } else if(Math.abs(startY - touchY(e)) > 3) {
                            $(this).parent("ul").height($(this).parent("ul").height()+20);
                            $(this).addClass("sorting")
                            .siblings().addBack().removeClass("selected");
                            currIndex = $(this).index();
                        }
                    }
                })
                .on("touchend", "li[draggable]", function (e) {
                    if($(this).find(".handle").length == 0) return;
                    if($(this).find(".handle")[0].contains(handle) && currIndex >= 0) {
                        var target = $(this).siblings(".insertAfter");
                        $(this).removeClass("sorting").css({ "top": "auto" })
                        .siblings().css("transition", "none")
                        .removeClass("insertBefore insertAfter")
                        .parent("ul").height("auto");
                        startY = null; currIndex = -1; handle = null; dragover = null;
                        moveAfter(this, (target.length > 0) ? target[0] : null);
                    }
                });
            };
        }
    };
})
.directive('compile', ['$compile', function ($compile) {
    return function(scope, element, attrs) {
        var ensureCompileRunsOnce = scope.$watch(
            function(scope) {
                return scope.$eval(attrs.compile);
            },
            function(value) {
                element.html(value);
                var c_div = $(element).parents(".content"),
                    picked_el = $(element).find(".picked");
                if(localStorage.getItem("settings-expandable") != "false") {
                    if(c_div.length > 0 && c_div[0].scrollHeight > 150) {
                        c_div.addClass("expandable");
                    }
                }
                $compile(element.contents())(scope);
                if($(element).parents(".wordpicker").length > 0) {
                    if(picked_el.length > 0) {
                        element[0].scrollTop = picked_el[0].offsetTop;
                    } else element[0].scrollTop = 0;
                }
                ensureCompileRunsOnce();
            }
        );
    };
}])
.directive('ngMozL10n', function () {
    return {
        restrict: "A",
        compile: function () {
            return function (scope, element, attrs) {
                attrs.$observe('ngMozL10n', function () {
                    element.attr('data-l10n-id', attrs.ngMozL10n);
                    navigator.mozL10n.once(function () {
                        navigator.mozL10n.localize(element[0], attrs.ngMozL10n);
                    });
                });
            };
        }
    };
})
.directive('ngRenderTerm', function ($compile) {
    return {
        restrict: "A",
        link: function (scope, element, attrs) {
            var term = escapeHtml(attrs.ngRenderTerm),
                result = "";
            if(scope.search_term == term && scope.search_term != "")
                result += "<b>" + term + "</b>";
            else result += term + " ("
                        + '<span data-ng-moz-l10n="lookup-synonym"></span>:'
                        + " <b>" + scope.search_term + "</b>)";
            element.html(result);
            $compile(element.contents())(scope);
        }
    };
})
.directive("ngDialog", function () {
    return {
        replace: true,
        restrict: "A",
        scope: {
            modal: "=data"
        },
        templateUrl: "partials/dialog.html"
    };
})
.factory("ngDialog", ["$document", "$compile", "$rootScope",
    function ($document, $compile, $rootScope) {
        var defaults = {
              type: "confirm",
              range: null,
              l20n: null,
              value: null,
              callbk: null,
              validate: null
            },
            defaults_l20n = {
              text: "",
              success: "dialog-ok",
              cancel: "dialog-cancel"
            },
            body = $document.find("body"),
            modalEl = angular.element('<div ng:dialog data="modal"></div>'),
            validateFn = function () { return true; },
            $scope = $rootScope.$new();

        function set_opts(options) {
            if(options.type == "progress" && typeof options.value === "undefined")
                options.value = [];
            options = angular.extend({}, defaults, options);
            if(options.type == "confirm") options.value = true;
            if(options.type == "prompt") {
                window.screen.mozLockOrientation("portrait-primary");
            } else {
                window.screen.mozUnlockOrientation();
            }
            if(options.l20n instanceof Object)
                options.l20n = angular.extend({}, defaults_l20n, options.l20n);
            $scope.modal = {
                visible: false,
                result: options.value,
                range: options.range,
                type: options.type,
                text: options.text,
                l20n: options.l20n,
                callbk: function (result) {
                    var callFn = options.callbk || validateFn;
                    callFn(result);
                    $scope.$modalClose();
                },
                validate: function (result) {
                    var callFn = options.validate || validateFn;
                    return callFn(result);
                }
            };
            if(!$scope.$$phase) { $scope.$apply(); }
        }

        $scope.$modalClose = function () { set_opts(defaults); };
        set_opts(defaults);
        $compile(modalEl)($scope);
        body.append(modalEl);

        return {
            update: function (res, text) {
                $scope.modal.result = res;
                if(typeof text !== "undefined")
                    $scope.modal.text = text;
                if(!$scope.$$phase) { $scope.$apply(); }
            },
            close: function () {
                set_opts(defaults);
            },
            open: function (options) {
                set_opts(options);
                $scope.modal.visible = true;
            },
            type: function () {
                return $scope.modal.type;
            }
        };
    }
]);
