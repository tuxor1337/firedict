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

function wordpicker_wrap(event) {
    var content = event.currentTarget,
        picked = event.explicitOriginalTarget,
        picked_wrapped = "",
        parent = picked.parentNode,
        wrapper;
    wordpicker_unwrap(content);
    if(picked.nodeType === 3) {
        wrapper = document.createElement("span");
        picked_wrapped = "<span>" + picked.textContent.split(" ").join(" </span><span>") + "</span>";
        $(wrapper).html(picked_wrapped);
        parent.replaceChild(wrapper, picked);
        $(document.elementFromPoint(event.clientX, event.clientY)).addClass("picked");
        $(wrapper).find("span:not(.picked)").each(function () {
            $(this).replaceWith($(this).text());
        });
        $(wrapper).replaceWith($(wrapper).html());
    }
}

function wordpicker_unwrap(content) {
    $(content).find(".picked").removeClass("picked");
}
