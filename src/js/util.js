/**
 * This file is part of FireDict
 *
 * Copyright 2018 Thomas Vogt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

"use strict";

var jq = angular.element;

jq.prototype.index = function () {
    var i = 0, child = this[0];
    while((child = child.previousSibling) != null) {
        if(child.nodeType === 1) i++;
    }
    return i;
};

jq.prototype.next = function () {
    var cur = this[0];
    while((cur = cur.nextSibling) && cur.nodeType !== 1) {}
    return jq(cur);
};

jq.prototype.prev = function () {
    var cur = this[0];
    while((cur = cur.previousSibling) && cur.nodeType !== 1) {}
    return jq(cur);
};

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

function touchXY(evt) {
    if(evt.originalEvent) evt = evt.originalEvent;
    var changed = evt.changedTouches;
    changed = (changed)?changed[0]:evt;
    return {
        "Y": changed.pageY,
        "X": changed.pageX
    }
}

function wordpicker_wrap(event) {
    var oContent = event.currentTarget,
        oPicked = event.explicitOriginalTarget,
        oParent = oPicked.parentNode,
        aSpans = [],
        oTouches;
    if(oPicked.nodeType === 3) {
        wordpicker_unwrap(oContent);
        oTouches = touchXY(event);
        oPicked.textContent.split(" ").forEach(function (sWord) {
            var oChild = document.createElement("span");
            oChild.textContent = sWord + " ";
            oParent.insertBefore(oChild, oPicked);
            aSpans.push(oChild);
        });
        oParent.removeChild(oPicked);
        document.elementFromPoint(oTouches.X,oTouches.Y)
            .classList.add("picked");
        aSpans.forEach(function (oSpan) {
            if(!oSpan.classList.contains("picked")) {
                oParent.replaceChild(
                    document.createTextNode(oSpan.textContent),
                    oSpan
                );
            }
        });
    }
}

function wordpicker_unwrap(content) {
    var matches = content.getElementsByClassName("picked");
    for(var i = 0; i < matches.length; i++) {
        matches[i].classList.remove("picked");
    }
}
