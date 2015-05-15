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
                var currIndex = -1,
                    dragover = null,
                    curr = null,
                    offsetX = 0, offsetY = 0,
                    ul_top = 0;

                var moveAfter = $scope.$eval($attr.moveFn);

                function touchXY(evt) {
                    var changed = evt.originalEvent.changedTouches;
                    if(changed) changed = changed[0];
                    else changed = evt.originalEvent;
                    return {
                        "Y": changed.pageY,
                        "X": changed.pageX
                    }
                }

                function dragover_handler() {
                    if(dragover === null) {
                        if(currIndex > 0) dragover = $(curr).prev();
                        else dragover = $(curr).next();
                        dragover = dragover.addClass("dragover")[0];
                    }
                    var pad = parseInt($(curr).css("margin-bottom")), refy = 0;
                    if($(dragover).index() == 0
                       || $(dragover).index() == 1 && currIndex == 0)
                        refy = ul_top - pad;
                    else refy = dragover_prev().getBoundingClientRect().bottom;
                    var crect = curr.getBoundingClientRect(),
                        drect = dragover.getBoundingClientRect(),
                        dheight = drect.bottom - drect.top + pad,
                        cheight = crect.bottom - crect.top + pad,
                        mbottom = (crect.top - refy - pad)*cheight/dheight;
                        mtop = cheight - mbottom;
                    if(mtop < 0 || mbottom < 0) {
                        var candidate = (mtop < 0)?dragover_next():dragover_prev();
                        if(candidate !== null) return dragover_reset(candidate);
                    }
                    mtop = Math.min(cheight,Math.max(mtop,0))
                    mbottom = Math.min(cheight,Math.max(mbottom,0))
                    $(dragover)
                    .css("margin-top", (mtop + pad) + "px")
                    .css("margin-bottom", (mbottom + pad) + "px");
                }

                function dragover_reset(candidate) {
                    $(dragover).removeClass("dragover");
                    dragover = $(candidate).addClass("dragover")[0];
                    $(curr).siblings()
                    .css("margin-top","").css("margin-bottom","");
                    dragover_handler();
                }

                function dragover_prev() {
                    var candidate = (currIndex+1 === $(dragover).index())?
                        $(curr).prev():$(dragover).prev();
                    if(candidate.length === 0) return null;
                    return candidate[0];
                }

                function dragover_next() {
                    var candidate = (currIndex-1 === $(dragover).index())?
                        $(curr).next():$(dragover).next();
                    if(candidate.length === 0) return null;
                    return candidate[0];
                }

                function curr_prev() {
                    var crect = curr.getBoundingClientRect(),
                        cmid = 0.5*(crect.bottom+crect.top),
                        drect = dragover.getBoundingClientRect(),
                        dmid = 0.5*(drect.bottom+drect.top);
                    if(cmid > dmid) return dragover;
                    else return dragover_prev();
                }

                function ontouchstart(e) {
                    var t = touchXY(e),
                        crect = curr.getBoundingClientRect(),
                        parent_ul = $(curr).parents("ul");
                    parent_ul.css("height", parent_ul[0].clientHeight + "px")
                    ul_top = parent_ul[0].getBoundingClientRect().top;
                    currIndex = $(curr).index();
                    offsetY = t.Y - crect.top;
                    offsetX = t.X - crect.left;
                    $(curr).css("width", $(curr).css("width"))
                        .addClass("sorting")
                        .css({ "top": crect.top + "px" })
                        .css({ "left": crect.left + "px" });
                    dragover_handler();
                }

                function ontouchmove(e) {
                    var t = touchXY(e);
                    $(curr).css({ "top": (t.Y - offsetY) + "px" })
                        .css({ "left": (t.X - offsetX) + "px" });
                    dragover_handler();
                }

                function ontouchend(e) {
                    var prev = curr_prev();
                    $(curr).removeClass("sorting").css("width","")
                        .css("top","").css("left","")
                        .siblings().removeClass("dragover")
                        .css("margin-top","").css("margin-bottom","")
                        .parents("ul").css("height","");
                    moveAfter(curr, prev);
                    curr = null, currIndex = -1, dragover = null;
                }

                $element
                .on("touchstart mousedown", "li[draggable] .handle", function(e){
                        e.preventDefault();
                        var li = $(this).parents("li");
                        if($(li).siblings().length > 0) {
                            curr = li[0];
                            ontouchstart(e);
                        }
                })
                .on("touchmove mousemove", function (e) {
                    if(currIndex >= 0) {
                        e.preventDefault();
                        ontouchmove(e);
                    }
                })
                .on("touchend mouseup", function (e) {
                    if(currIndex >= 0) {
                        e.preventDefault();
                        ontouchend(e);
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
