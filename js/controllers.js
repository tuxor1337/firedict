
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
        $scope.dictMoveAfter = function (selected, target) {
            var aDictSorted = $scope.dictionaries.concat().sort(function (a,b) {
                if (a.rank < b.rank) return -1;
                if (a.rank > b.rank) return 1;
                return 0;
            });
            var currVer = parseInt($(selected).find(".color").text()),
                currIdx = -1;
            for(var i = 0; i < aDictSorted.length; i++) {
                if(currVer == aDictSorted[i].version) currIdx = i;
            }
            if(target == null) {
                if(currIdx == 0) return;
                aDictSorted.unshift(aDictSorted.splice(currIdx, 1)[0]);
            } else {
                var curr = aDictSorted.splice(currIdx,1)[0],
                    targetVer = parseInt($(target).find(".color").text());
                for(var i = 0; i < aDictSorted.length; i++) {
                    if(targetVer == aDictSorted[i].version) {
                        aDictSorted.splice(i+1, 0, curr); break;
                    }
                }
            }
            for(var i = 0; i < aDictSorted.length; i++) {
                $scope.dictById(aDictSorted[i].version).rank = i;
            }
            if(!$scope.$$phase) { $scope.$apply(); }
        };
    }
])
.controller("lookupCtrl", ["$scope", "$rootScope", "$timeout", "dictWorker", "ngDialog",
    function ($scope, $rootScope, $timeout, dictWorker, ngDialog) {
        function escapeHtml(text) {
            var map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            
            return text.replace(/[&<>"']/g, function(m) { return map[m]; });
        }
        
        $scope.showingEntry = false;
        $scope.idle = false;
        $scope.matches = [];
        $scope.entries = [];
        $scope.resources = {};
        
        $scope.lookup = function (val) {
            if(val == $scope.search_term) {
                $scope.idle = true;
                $scope.matches = [];
                $rootScope.search_term = $scope.search_term;
                dictWorker.query("lookup", $scope.search_term)
                .then(function (matches) {
                    if($scope.search_term == val) {
                        $scope.matches = matches;
                        $scope.idle = false;
                        if(!$scope.$$phase) { $scope.$apply(); }
                    }
                });
            }
        };
        
        $scope.lookup_enterpressed = function () {
            if($scope.showingEntry) return;
            $scope.lookup($scope.search_term);
        };
        
        $scope.lookup_data_changed = function () {
            var val = $scope.search_term,
                milliseconds = 1500 - 250*Math.min(val.length,4);
            if($scope.showingEntry) return;
            var delay = (function(){
              var timer = 0;
              return function(callback, ms){
                clearTimeout (timer);
                timer = $timeout(callback, ms);
              };
            })();
            delay(function () { $scope.lookup(val); }, milliseconds);
        };
        
        $scope.show_entry = function(matchObj) {
            $scope.idle = true;
            $scope.matches = [];
            $scope.entries = [];
            if(!$scope.$$phase) { $scope.$apply(); }
            var entr = matchObj, term = matchObj;
            if(matchObj instanceof Object) {
                entr = matchObj.entries;
                term = matchObj.term;
            }
            $scope.search_term = term;
            dictWorker.query("entry", entr)
            .then(function (entries) {
                $scope.showingEntry = true;
                $scope.entries = entries;
                if(!$scope.$$phase) { $scope.$apply(); }
            });
        };
        
        $scope.$watch(
            "[search_term, dictionaries]",
            $scope.lookup_data_changed, true
        );
        
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
            term = escapeHtml(term);
            var result = "";
            if($scope.search_term == term && $scope.search_term != "")
                result += "<b>" + term + "</b>";
            else result += term + " (Synonym: <b>" + $scope.search_term + "</b>)";
            return result;
        };
        $scope.render_content = function (d, did) {
            function inject_resource(name) {
                if(!$scope.resources.hasOwnProperty(did))
                    $scope.resources[did] = {};
                if(!$scope.resources[did].hasOwnProperty(name)) {
                    dictWorker.query("resource", {
                            did: did, name: name
                    }).then(function (blob) {
                        if(blob == null)
                            console.log($scope.dictById(did).alias +
                                ": File " + name + " not found.");
                        else {
                            $scope.resources[did][name] = window.URL.createObjectURL(blob);
                            if(!$scope.$$phase) { $scope.$apply(); }
                        }
                    });
                }
            }
            function render_html_content(html_markup) {
                var tmp_obj = $("<div />").html(html_markup);
                $(tmp_obj).find(":not("
                    + "p, font, span, div, table, tr, td, tbody, strong, "
                    + "br, i, a, b, u, img, sup, sub, ul, ol, li, abbr, "
                    + "center, left, right, em, dd, dt, blockquote, small, "
                    + "code, del, h1, h2, h3, h4, h5, h6"
                + ")").each(function () {
                    console.log("Html code injection: " + this.tagName);
                    if($(this).children().length == 0)
                        $(this).replaceWith($(this).text());
                    else $(this).children().unwrap();
                });
                $(tmp_obj).find("center, left, right").each(function () {
                    $(this).replaceWith(
                        $("<p />").html($(this).html())
                        .css("text-align",this.tagName)
                    );
                });
                $(tmp_obj).find("img").each(function () {
                    var elImg = this,
                        img_filename = $(elImg).attr("src")
                            .replace(/^\x1E/, '').replace(/\x1F$/, '');
                    $(elImg).attr("src", 
                        "{{resources[" + did + "]['" + img_filename + "']}}");
                    if($(elImg).attr("align") == "middle") {
                        $(elImg).removeAttr("align")
                            .css("vertical-align","middle");
                    }
                    inject_resource(img_filename);
                });
                $(tmp_obj).find("a").each(function () {
                    var linkText = $(this).text(),
                        linkRef = $(this).attr("href");
                    if("bword://" != linkRef.substring(0,8)) {
                        $(this).replaceWith(linkText);
                    } else {
                        linkRef = linkRef.substring(8).replace(/'/g, "\\'")
                            .replace(/^ /g, "");
                        $(this).attr("href","javascript:void(0)")
                                .attr("ng-click", "show_entry('" + linkRef + "')");
                    }
                });
                return $(tmp_obj).html();
            }
            function render_pango_content(pango_markup) {
                var tmp_obj = $("<div/>").html(pango_markup.replace(/\n/g,"<br>"));
                $(tmp_obj).find(":not("
                    + "span, big, s, tt, b, i, sub, sup, small, u, br"
                + ")")
                .each(function () {
                    console.log("Pango code injection: " + this.tagName);
                    if($(this).children().length == 0)
                        $(this).replaceWith($(this).text());
                    else $(this).children().unwrap();
                });
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
                    if(sup) {
                        $(this).replaceWith(
                            $(replacement).html($(this).html())
                        );
                    } else { 
                        $(this).replaceWith(
                            $("<sup/>").append(
                                $(replacement).html($(this).html())
                            )
                        );
                    }
                });
                $(tmp_obj).find("big").each(function () {
                    $(this).replaceWith(
                        $("<span/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("tt").each(function () {
                    $(this).replaceWith(
                        $("<code/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("s").each(function () {
                    $(this).replaceWith(
                        $("<del/>").html($(this).html())
                    );
                });
                return render_html_content($(tmp_obj).html());
            }
            function render_xdxf_content(xdxf_markup) {
                var tmp_obj = $("<div />").html(xdxf_markup);
                $(tmp_obj).find(":not("
                    + "k, pos, abr, c, kref, ex, "
                    + "big, small, i, sup, sub, b, tt, blockquote"
                + ")").each(function () {
                    console.log("XDXF code injection: " + this.tagName);
                    if($(this).children().length == 0)
                        $(this).replaceWith($(this).text());
                    else $(this).children().unwrap();
                });
                $(tmp_obj).find("k").each(function () {
                    $(this).replaceWith(
                        $("<dt/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("pos").each(function () {
                    $(this).replaceWith(
                        $("<p/>").append(
                            $("<i/>").html($(this).html())
                        )
                    );
                    ;
                });
                $(tmp_obj).find("big").each(function () {
                    $(this).replaceWith(
                        $("<span/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("tt").each(function () {
                    $(this).replaceWith(
                        $("<code/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("abr").each(function () {
                    $(this).replaceWith(
                        $("<abbr/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("c").each(function () {
                    $(this).replaceWith(
                        $("<span/>").html($(this).html())
                        .css("color",$(this).attr("c"))
                    );
                });
                $(tmp_obj).find("kref").each(function () {
                    $(this).replaceWith(
                        $("<a/>").html($(this).html())
                        .attr("href","bword://"+$(this).text().trim())
                    );
                });
                $(tmp_obj).find("ex").each(function () {
                    $(this).replaceWith(
                        $("<span/>").html($(this).html())
                        .css("color","#4682B4")
                    );
                });
                return render_html_content($(tmp_obj).html());
            }
            function render_resource_content(res) {
                var result = [], aRes = res.split("\n");
                aRes.forEach(function () {
                    var type = res.split(":")[0],
                        name = res.split(":")[1];
                    if(type == "img") {
                        inject_resource(name);
                        result.push("<img src=\"{{resources[" + did + "]['" + name + "']}}\" />");
                    }
                    console.log("Resource type not supported: " + d.type);
                    // at least: snd, vdo, att
                    result.push("Resource: " + res);
                });
                return result.join("<br />\n");
            }
            function render_plain_content(plain_text) {
                return $("<div />").text(plain_text).html()
            }
            if("g" == d.type)
                return render_pango_content(d.content);
            else if("h" == d.type)
                return render_html_content(d.content);
            else if("x" == d.type)
                return render_xdxf_content(d.content);
            else if("w" == d.type)
                return render_html_content(wiki2html(d.content));
            else if("r" == d.type)
                return render_resource_content(d.content);
            else if("m" == d.type)
                return render_plain_content(d.content);
            else if("t" == d.type)
                return render_plain_content("Pronunciation: /"+d.content+"/");
            else if("y" == d.type)
                return render_plain_content("YinBiao/KANA: "+d.content);
            
            console.log("Type not supported: " + d.type); // at least: "kWPX"
            return render_plain_content(d.content);
        };
        $scope.termOrderFn = function (entry) {
            return entry.term.replace(/\(([0-9])\)$/g, '(0$1)');
        };
    }
])
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
        + "<p>http://tuxor1337.github.io/firedict/</p>"
        + "<p>Scans for dictionaries in your sdcard's \"dictdata\" directory.</p>";
});
