/*global performXSL, content, BrowserViewSourceOfDocument, AddonManager, Components, DOMParser, XPathResult*/
/*jslint vars:true*/
var xslresults = (function () {'use strict';

var $ = function (id, doc) {
    if (!doc) {
        doc = document;
    }
    return doc.getElementById(id);
};
var PHP = {};
PHP.strpos = function (haystack, needle, offset) {
    var i = haystack.indexOf(needle, offset);
    return (i >= 0) ? i : false;
};
PHP.in_array = function (needle, haystack, strict0) {
    // http://kevin.vanzonneveld.net
    // +   original by: Kevin van Zonneveld (http://kevin.vanzonneveld.net)
    // *     example 1: in_array('van', ['Kevin', 'van', 'Zonneveld']);
    // *     returns 1: true
    var found = false, key, strict = !!strict0;
    for (key in haystack) {
        if ((strict && haystack[key] === needle) || (!strict && haystack[key] == needle)) {
            found = true;
            break;
        }
    }
    return found;
};

var xslresults = {
    onLoad: function() {
        // initialization code
        this.initialized = true;

        this.strbundle = $('xslresults-strings');
        this.OS = this.performXSL.OS;
        this.OSfile_slash = this.performXSL.OSfile_slash;

        var extid = 'xslresults@brett.zamir'; // the extension's id from install.rdf
        Components.utils['import']('resource://gre/modules/AddonManager.jsm');
        // the path may use forward slash ('/') as the delimiter
        var that = this;
        AddonManager.getAddonByID(extid, function (addon) {
            that.addon = addon;
        });

        this.prefs = this.performXSL.prefs;
        // This branch must be set in both the properties file and prefs js file: http://developer.mozilla.org/en/docs/Code_snippets:Preferences#nsIPrefLocalizedString
        this.branch = this.performXSL.branch;


        this.fURL = null;

        this.startLoadListeners();
    },
    docEvaluateArray : function (expr, doc, context, resolver) {
        doc = doc || document;
        resolver = resolver || null;
        context = context || doc;

        var result = doc.evaluate(expr, context, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var i, a = [];
        for(i = 0; i < result.snapshotLength; i++) {
            a[i] = result.snapshotItem(i);
        }
        return a;
    },
    startLoadListeners : function () {
        var appContent = $('appcontent');
        var that = this;
        function assignCB (xsl, fileext, prestyle) {
            that.xsl = xsl;
            that.fileext = fileext;
            that.prestyle = prestyle;
        }
        appContent.addEventListener('DOMContentLoaded',
            function(e) { // DON'T add alerts here or will do an infinite loop!
                if (!e.target.location) {
                    return;
                }
                var href = e.target.location.href;
                if (href !== 'about:blank' && e.originalTarget.nodeName === '#document') { // Need latter test to avoid xul:images (favicons) per http://developer.mozilla.org/en/docs/Code_snippets:On_page_load
                    
                    // Including file retrieval here to be able to get new results after changing in XSL window
                    var xmlDoc0 = that.performXSL.loadfile('xslresults_querydata.xml');
                    if (typeof xmlDoc0 === 'string' && (!xmlDoc0 || xmlDoc0.match(/^\s*$/))) {
                        return;
                    }

                    var xmlDoc = new DOMParser().parseFromString(xmlDoc0, 'text/xml');
                    var urlmatch = that.performXSL.findMatchedURL(href, xmlDoc, assignCB);
                    if (!urlmatch) {
                        return;
                    }
                    var cbo = {
                        processResult : function (content) {
                            var charset = new DOMParser().parseFromString(content, 'text/xml').characterSet; // Do we really need to do this?
                            var filepath = that.performXSL.writeFile(content, that.fileext, charset);
                            e.target.location.href = filepath;
                        }
                    };
                    if (that.prestyle) {
                        that.performXSL.getPrestyleDoc(href, that.xsl, cbo, e.target.characterSet);
                    }
                    else {
                        var wininfo = that.performXSL.getWindowContent(e.target.defaultView); // defaultView grabs window owner of this document
                        that.performXSL.getDataForXSL(wininfo.content, that.xsl, cbo);
                    }
                }
            },
            false
        );
    },
    getUrlSpec : function (myfile) {
        // returns nsIFile for the given extension's file
        var url = this.addon.getResourceURI(myfile);
        return url.spec;
    },
    openXSLWindow : function () {
        this.onMenuItemCommand();
    },
    onViewOriginalXMLPlain : function () {
        this.onViewOriginalXML();
    },
    onViewOriginalXMLTextBox : function () {
        this.onViewOriginalXML(true);
    },
    onViewOriginalXML : function (textbox) {
        var href = window.content.location.href;
        var that = this;
        var cb2 = function (data, ext) { // merge this with other cb2 as method of this object
            if (textbox) {
                  data = '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8" /></head>'+
                              '<body><textarea cols="100%" rows="40">'+data+'</textarea></body></html>';
                  ext = 'html';
            }
			var where = that.branch.getCharPref('open_where');
            if (where === 'open_window') {
                  that.performXSL.openfile(data, ext); // works to open a new window
            }
			else if (where === 'open_tab') {
				that.performXSL.openTab(data, ext);
			}
            else {
                  // var charset = newDocument.characterSet; // Do we really need to do this?
                  var charset = 'UTF-8';
                  var filepath = that.performXSL.writeFile(data, ext, charset); // Any way (or need) to dynamically change extension here?
                  window.content.location.href = filepath;
            }
        };
        this.performXSL.getPrestyleDoc(href, null, null, 'UTF-8', cb2, textbox); // window.content.document.characterSet
    },
    // These might also be displayed as text -- i.e. with syntax coloring as with View Source (XML)
    onViewResultantTransformiixSource : function () {
        this.onViewResultantSource(1);
    },
    onViewResultantTransformiixSourceTextBox : function () {
        this.onViewResultantSource(1, true);
    },
    onViewResultantSource : function (enginetype, textbox) {
        var that = this;
        var href = window.content.location.href;

        // 1) Grab original raw XML with stylesheet
        var wininfo = that.performXSL.getWindowContent(window);

        var cb0 = function (buf) { // Gets XML
            if ((wininfo.ctype === 'xml' && that.branch.getBoolPref('xmlstripdtd')) ||
                  (wininfo.ctype=== 'html' && that.branch.getBoolPref('htmlstripdtd'))) {
              buf = buf.replace(/<!DOCTYPE[^>\[]*\[[^\]]*\]>/g, '').replace(/<!DOCTYPE[^>]*>/g, '');
            }
            // 2) Use stylesheet to get raw XSL
            var stylesheetURL = false;
            var cb1 = function (stylesheet) {
                // 3) apply XSL to XML
                var cb2 = {
                    processResult : function (data, ext) {
                        if (textbox) {
                            data = '<textarea cols="100%" rows="40">'+data+'</textarea>';
                            ext = 'html';
                        }
						var where = that.branch.getBoolPref('open_where');
                        if (where === 'open_window') {
                            this.openfile(data, ext); // works to open a new window
                        }
						else if (where === 'open_tab') {
							this.openTab(data, ext); // works to open a new tab
						}
                        else {
                            // var charset = newDocument.characterSet; // Do we really need to do this?
                            var charset = 'UTF-8';
                            var filepath = that.performXSL.writeFile(data, ext, charset); // Any way (or need) to dynamically change extension here?
                            window.content.location.href = filepath;
                        }
                    }
                };

                that.performXSL.finish(stylesheet, buf, cb2, enginetype); // 1 is Transformiix
            };
            if (stylesheetURL) {
                this.performXSL.getPrestyleDoc(stylesheetURL, null, null, 'UTF-8', cb1, true);
            }
            else {
                alert('No stylesheet was found');
            }
        };
        this.performXSL.getPrestyleDoc(href, null, null, 'UTF-8', cb0, true); // window.content.document.characterSet
    },
    // Not in use (probably should transfer option for putting data in textbox to above
    onViewResultantSourceTextbox: function() {
        var wininfo = this.performXSL.getWindowContent(window);
        var data = wininfo.content;
        
        var win = window.openDialog(); // plain window.open doesn't work right
        var doc = win.document;
        doc.open();

        data = '<textarea cols="100%" rows="40">' + data + '</textarea>';
        doc.writeln(data);
        doc.close();
    },
    viewSource : function () {
        // From chrome://browser/content/browser.xul
        BrowserViewSourceOfDocument(content.document);
    },
    onMenuItemCommand: function() {
        // Open and focus on query window, sending the current document and the URL Class loader data
        var wininfo = this.performXSL.getWindowContent(window);
        var ctype = wininfo.ctype;
        var conttype = wininfo.contentType;
        var data = wininfo.content;

        var xsldialog = window.openDialog('chrome://xslresults/content/getxsldata.xul', 'getxsldata',
                 'chrome, resizable, scrollbars, minimizable', /* centerscreen,  */ data, null /* todo: remove; no longer in use*/,
                 this.fURL, ctype, conttype);
        xsldialog.focus();
    },
    performXSL: performXSL
};

return xslresults;

}());

window.addEventListener('load', function(e) {'use strict';
    performXSL.onLoad(e);
    xslresults.onLoad(e);
}, false);
