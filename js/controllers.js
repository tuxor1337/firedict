
var FireDictControllers = angular.module("FireDictControllers", ["FireDictDirectives"])
.controller("manageCtrl", ["$scope", "ngDialog", "dictWorker",
    function ($scope, ngDialog, dictWorker) {
        function RGBToHex(aRGB){
            var r = aRGB[0], g = aRGB[1], b = aRGB[2],
                bin = r << 16 | g << 8 | b;
            return (function(h){
                    return "#" + new Array(7-h.length).join("0")+h
            })(bin.toString(16).toUpperCase())
        }
        
        function hexToRGB(hex) {
            hex = parseInt(hex.substring(1), 16);
            var r = hex >> 16,
                g = hex >> 8 & 0xFF,
                b = hex & 0xFF;
            return [r,g,b];
        }

        $scope.title = "Manage Dictionaries";
        $scope.selected = -1;
        $scope.select = function (dict) {
            if($scope.selected == dict.version)
                $scope.selected = -1;
            else $scope.selected = dict.version;
        };
        $scope.isDark = function (hexColor) {
            var rgb = hexToRGB(hexColor),
                max = Math.max(rgb),
                sum = rgb[0] + rgb[1] + rgb[2];
            return sum < 360 || max < 190;
        };
        $scope.toggleActive = function (dict) {
            if(dict.active) dict.active = false;
            else dict.active = true;
        };
        $scope.rename = function (dict) {
            ngDialog.open({
                type: "prompt",
                text: "Type in a new alias for this dictionary:",
                value: dict.alias,
                callbk: function (alias) {
                    if(alias !== null) dict.alias = alias;
                }
            });
        };
        $scope.setColor = function (dict) {
            ngDialog.open({
                type: "color",
                text: "Choose a color for this dictionary:",
                value: hexToRGB(dict.color),
                callbk: function (color) {
                    if(color !== null) dict.color = RGBToHex(color);
                }
            });
        };
        $scope.reindex = function () {
            dictWorker.query("init");
        };
    }
])
.controller("lookupCtrl", ["$scope", "dictWorker", "ngDialog", function ($scope, dictWorker, ngDialog) {
    $scope.showingEntry = false;
    $scope.idle = false;
    $scope.matches = [];
    $scope.entries = [];
    $scope.resources = {};
    
    $scope.lookup = function (val) {
        if($scope.showingEntry) return;
        var delay = (function(){
          var timer = 0;
          return function(callback, ms){
            clearTimeout (timer);
            timer = setTimeout(callback, ms);
          };
        })();
        delay(function () {
            if(val == $scope.search_term) {
                dictWorker.query("lookup", $scope.search_term)
                .then(function (matches) {
                    $scope.matches = matches;
                    $scope.idle = false;
                    if(!$scope.$$phase) { $scope.$apply(); }
                });
            }
        }, 400);
    };
    $scope.show_entry = function(matchObj) {
        $scope.showingEntry = true;
        $scope.matches = [];
        $scope.idle = true;
        var entr = matchObj, term = matchObj;
        if(matchObj instanceof Object) {
            entr = matchObj.entries;
            term = matchObj.term;
        }
        $scope.search_term = term;
        dictWorker.query("entry", entr)
        .then(function (entries) {
            $scope.entries = entries;
            if(!$scope.$$phase) { $scope.$apply(); }
        });
    };
    
    $scope.$watch("search_term", $scope.lookup);
    
    $scope.back = function () {
        if($scope.showingEntry) {
            $scope.showingEntry = false;
            $scope.lookup($scope.search_term);
        }
    };
    $scope.matchDictFilter = function (match) {
        return function (dict) {
            var result = false;
            match.entries.forEach(function (e) {
                if(e[2] == dict.version) result = true;
            });
            return result;
        };
    };
    $scope.entryDictFilter = function (dict) {
        var result = false;
        $scope.entries.forEach(function (e) {
            if(e.did == dict.version) result = true;
        });
        return result;
    };
    $scope.render_term = function (term) {
        var result = "";
        if($scope.search_term == term) result += "<b>" + $scope.search_term + "</b>";
        else result += term + " (Synonym: <b>" + $scope.search_term + "</b>)";
        return result;
    };
    $scope.render_content = function (d, did) {
        function render_pango_content(pango_markup) {
            var tmp_obj = $("<div/>").html(pango_markup);
            $(tmp_obj).find("span").each(function () {
                var replacement = $("<span/>"), sup = false;
                $.each(this.attributes, function(dummy, attrib){
                    var name = attrib.name;
                    var value = attrib.value;
                    if(name == "font_desc")
                        $(replacement).css("font", value);
                    else if(name == "font_family" || name == "face")
                        $(replacement).css("font-family", value);
                    else if(name == "size" && !isNaN(value))
                        $(replacement).css("font-size", value);
                    else if(name == "style")
                        $(replacement).css("font-style", value);
                    else if(name == "weight") {
                        if(value == "ultrabold") value = "800";
                        else if(value == "heavy") value = "900";
                        else if(value == "light") value = "300";
                        else if(value == "ultralight") value = "200";
                        $(replacement).css("font-weight", value);
                    } else if(name == "variant")
                        $(replacement).css("font-variant",
                            value.replace("smallcaps","small-caps"));
                    else if(name == "stretch") {
                        value.replace(/(ultra|extra|semi)(condensed|expanded)/g, "$1-$2");
                        $(replacement).css("font-stretch", value);
                    } else if(name == "foreground")
                        $(replacement).css("color", value);
                    else if(name == "background")
                        $(replacement).css("background-color", value);
                    else if(name == "underline") {
                        if(value == "double")
                            $(replacement).css("border-bottom", "1px #000 double");
                        else if(value == "low")
                            $(replacement).css("border-bottom", "1px #000 solid");
                        else if(value == "single")
                            $(replacement).css("text-decoration", "underline");
                    } else if(name == "strikethrough" && value == "true")
                        $(replacement).css("text-decoration", "line-through");
                    else if(name == "rise" && value != "0") sup = true;
                });
                if(sup) replacement = $("<sup/>").append(replacement);
                $(this).replaceWith(replacement).html($(this).html());
            });
            $(tmp_obj).find("big").each(function () {
                $(this).replaceWith($("<span/>")).html($(this).html());
            });
            $(tmp_obj).find("s").each(function () {
                $(this).replaceWith($("<del/>")).html($(this).html());
            });
            $(tmp_obj).find("tt").each(function () {
                $(this).replaceWith($("<code/>")).html($(this).html());
            });
            return $(tmp_obj).html();
        }
        function render_html_content(html_markup) {
            var tmp_obj = $("<div />").html(html_markup);
            $(tmp_obj).find("img")
            .each(function () {
                var elImg = this,
                    img_filename = $(elImg).attr("src")
                        .replace(/^\x1E/, '').replace(/\x1F$/, '');
                $(elImg).attr("src", "{{resources['" + img_filename + "']}}");
                if(!$scope.resources.hasOwnProperty(img_filename)) {
                    dictWorker.query("resource", {
                            did: did, name: img_filename
                    }).then(function (blob) {
                        if(blob == null)
                            console.log("File " + img_filename + " not found.");
                        else {
                            var reader = new FileReader();
                            reader.onload = function (e) {
                                $scope.resources[img_filename] = e.target.result;
                                if(!$scope.$$phase) { $scope.$apply(); }
                            };
                            reader.readAsDataURL(blob);
                        }
                    });
                }
            });
            $(tmp_obj).find("a")
            .each(function () {
                var linkText = $(this).text(),
                    linkRef = $(this).attr("href");
                if("bword://" != linkRef.substring(0,8)) {
                    $(this).replaceWith(linkText);
                } else {
                    linkRef = linkRef.substring(8).replace(/'/g, "\\'");
                    $(this).attr("href","javascript:void(0)")
                            .attr("ng-click", "show_entry('" + linkRef + "')");
                }
            });
            return $(tmp_obj).html();
        }
        if("mxtykwr".indexOf(d.type) != -1)
            return d.content;
        else if("g".indexOf(d.type) != -1)
            return render_pango_content(d.content);
        else if("h".indexOf(d.type) != -1)
            return render_html_content(d.content);
    };
}])
.controller("settingsCtrl", ["$scope", "ngDialog", "dictWorker",
    function ($scope, ngDialog, dictWorker) {
        $scope.title = "Settings";
        $scope.settings = [
            {
                name: "Clear history",
                onclick: function () {
                    ngDialog.open({
                        text: "Do you really want to clear the history?",
                        success: "Yes, I'm sure",
                        cancel: "No, forget it...",
                        callbk: function (result) {
                            if(result === true) {
                                dictWorker.query("clear_history");
                            }
                        }
                    });
                }
            }
        ];
    }
])
.controller("aboutCtrl", function ($scope) {
    $scope.title = "About FireDict";
    $scope.description = "<p>Open source offline dictionary webapp for StarDict dictionaries hosted on GitHub</p>"
        + "<p>https://github.com/tuxor1337/firedict</p>"
        + "<p>Scans for dictionaries in your sdcard's \"dictdata\" directory.</p>";
});
