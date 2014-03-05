
Array.prototype.move = function(from, to) {
    this.splice(to, 0, this.splice(from, 1)[0]);
};

var FireDictDirectives = angular.module("FireDictDirectives", [])
.directive("ngHeader", function () {
    return { 
        replace: true,
        transclude: true,
        restrict: "A",
        scope: {
            "onFocus": '=focus',
            "searchTerm": '=term',
            "toggleSidebar": '=toggle',
            "onReindex": '=reindex'
        },
        link: function ($scope, $element, $attrs) {
            $scope.type = $attrs.type;
        },
        templateUrl: "partials/header.html"
    };
})
.directive("ngDrawer", function () {
    return { 
        replace: true,
        transclude: true,
        restrict: "A",
        link: function ($scope, $element, $attrs) {
            $scope.title = $attrs.title;
        },
        templateUrl: "partials/sidebar.html"
    };
})
.directive("ngSortable", function () {
    return {
        compile: function ($element) {
            $element.find("li").prop("draggable", true);
            return function ($scope, $element) {
                function moveDict(ver, target) {
                    var oldrank = $rootScope.dictById(ver).rank,
                        newrank = $rootScope.dictById(target).rank;
                    $scope.dictionaries.forEach(function (dict) {
                        if(oldrank > newrank && dict.rank >= newrank && dict.rank < oldrank) dict.rank += 1;
                        else if(oldrank < newrank && dict.rank <= newrank && dict.rank > oldrank) dict.rank -=1;
                        if(dict.version == ver) dict.rank = newrank;
                    });
                    if(!$scope.$$phase) { $scope.$apply(); }
                }
                
                var target, refIdx;
                $element
                .on("mousedown", "li", function (e) {
                    target = e.target;
                    refIdx = $(this).index();
                })
                .on("dragstart", "li", function (e) {
                    if($(this).find(".handle")[0].contains(target)) {
                        $(this).css("opacity","0.1");
                        e.originalEvent.dataTransfer.setData("text/plain","jo");
                        $element.addClass("sorting")
                        .find("li").removeClass("selected");
                        $scope.selected = -1;
                    } else {
                        e.preventDefault();
                    }
                })
                .on("dragover", "li", function (e) {
                    if(!$(this).find(".handle")[0].contains(target)) {
                        e.preventDefault();
                        e.originalEvent.dataTransfer.dropEffect = "move";
                    }
                })
                .on("dragenter", "li", function (e) {
                    if(!$(this).find(".handle")[0].contains(target)) {
                        if("undefined" === typeof $(this).data("cnt"))
                            $(this).data("cnt", 0)
                        var cnt = $(this).data("cnt");
                        if(cnt++ == 0) {
                            if($(this).index() > refIdx)
                                $(this).addClass("insertAfter");
                            else $(this).addClass("insertBefore");
                        }
                        $(this).data("cnt", cnt);
                    }
                })
                .on("dragleave", "li", function (e) {
                    if(!$(this).find(".handle")[0].contains(target)) {
                        var cnt = $(this).data("cnt");
                        if(--cnt == 0) {
                            $(this).removeClass("insertAfter insertBefore");
                        }
                        $(this).data("cnt", cnt);
                    }
                })
                .on("dragend", "li", function (e) {
                    $(this).css("opacity","1");
                    $element.find("li").data("cnt",0)
                        .removeClass("insertBefore insertAfter");
                    $element.removeClass("sorting");
                })
                .on("drop", "li", function (e) {
                    if(!$(this).find(".handle")[0].contains(target)) {
                        e.preventDefault();
                        var dragver = parseInt($(target).parents("li").find("div.color").text()),
                            dropver = parseInt($(this).find("div.color").text());
                        moveDict(dragver,dropver);
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
                $compile(element.contents())(scope);
                ensureCompileRunsOnce();
            }
        );
    };
}])
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
              text: "Default text",
              success: 'OK',
              cancel: 'Cancel',
              value: null,
              callbk: null
            },
            body = $document.find("body"), 
            modalEl = angular.element('<div ng:dialog data="modal"></div>'),
            closeFn = function () { set_opts(defaults); },
            $scope = $rootScope.$new();
            
        function set_opts(options) {
            if(options.type == "progress" && typeof options.value === "undefined")
                options.value = [];
            options = angular.extend({}, defaults, options);
            if(options.type == "confirm") options.value = true;
            $scope.modal = {
                visible: false,
                result: options.value,
                type: options.type,
                text: options.text,
                success: options.success,
                cancel: options.cancel,
                callbk: function (result) {
                    var callFn = options.callbk || closeFn;
                    callFn(result);
                    $scope.$modalClose();
                }
            };
            if(!$scope.$$phase) { $scope.$apply(); }
        }
        
        $scope.$modalClose = closeFn;
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
])
.factory("dictWorker", function () {
    var oWorker = new Worker("js/worker.js"),
        oListeners = { 
            reply: function (obj) {
                transactions[obj.tid](obj.data);
                delete transactions[obj.tid];
            }
        },
        transactions = [];
    
    oWorker.onmessage = function (oEvent) {
        if (oEvent.data instanceof Object
            && oEvent.data.hasOwnProperty("vo42t30")
            && oEvent.data.hasOwnProperty("e4b869b")
            && oEvent.data.hasOwnProperty("rnb93qh")) {
            var tid = oEvent.data.e4b869b;
            oListeners[oEvent.data.vo42t30]({
                tid: tid,
                data: oEvent.data.rnb93qh,
                reply: function (data) {
                    oWorker.postMessage({
                        "bk4e1h0": "reply",
                        "df65d4e": tid,
                        "ktp3fm1": data
                    });
                }
            });
        } else console.log("Wk: " + oEvent.data);
    };
    
    oWorker.onerror = function (e) {
            e.preventDefault();
            console.error("Wk: " + e.filename + "(" + e.lineno + "): " + e.message);
    };
    
    return {
        query: function () {
            if (arguments.length < 1) {
                throw new TypeError("dictWorker.query - not enough arguments");
                return;
            }
            var queryObj = {
                "bk4e1h0": arguments[0],
                "df65d4e": 0,
                "ktp3fm1": arguments[1]
            }
            return new Promise(function (resolve, reject) {
                queryObj.df65d4e = transactions.length;
                transactions.push(resolve);
                oWorker.postMessage(queryObj);
            });
        },
        addListener: function (sName, fListener) {
            oListeners[sName] = fListener;
        }
    };
});
