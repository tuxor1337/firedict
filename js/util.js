/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

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

