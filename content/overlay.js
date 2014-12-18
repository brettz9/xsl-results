/*
Copyright 2007, 2008, 2009 Brett Zamir
    This file is part of XSL Results.

    XSL Results is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    XSL Results is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with XSL Results.  If not, see <http://www.gnu.org/licenses/>.
*/

(function () {

var Cc = Components.classes;
var Ci = Components.interfaces;

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

//    this.OS = this.searchString(this.dataOS);
//    this.OSfile_slash = (this.OS === 'Windows') ? '\\' : '/'; // The following doesn't seem to auto-convert forward slashes to backslashes, so this is needed (though why is there no problem in overlay.js for Windows? Probably since only being used there for Java)
//    var path = Cc['@mozilla.org/file/directory_service;1'].getService( Ci.nsIProperties).get('ProfD', Ci.nsIFile).path; // Get path to user profile folder
//    var extpath = path+this.OSfile_slash+'extensions'+this.OSfile_slash+'xslresults@brett.zamir'+this.OSfile_slash;

        // From http://developer.mozilla.org/en/docs/Code_snippets:File_I/O
        this.extid = 'xslresults@brett.zamir'; // the extension's id from install.rdf
        var em = Cc['@mozilla.org/extensions/manager;1'].getService(Ci.nsIExtensionManager);
        // the path may use forward slash ('/') as the delimiter
        this.extdir = em.getInstallLocation(this.extid);

        var fURL = [];
        this.prefs = this.performXSL.prefs;
        // This branch must be set in both the properties file and prefs js file: http://developer.mozilla.org/en/docs/Code_snippets:Preferences#nsIPrefLocalizedString
        this.branch = this.performXSL.branch;
        // if (this.OS) {
          /* Since hard-wiring now, don't need preferences (also ensures if migrating a profile, that it will still work on a different machine
                var Saxonjardirtype = '0jardir'; // '0jardir_'+this.OS;
        var Saxonjardir = this.branch.getComplexValue(Saxonjardirtype,
                        Ci.nsIPrefLocalizedString).data;
        if (Saxonjardir == '' || Saxonjardir == ' ') {
            var temp = Cc['@mozilla.org/pref-localizedstring;1']
                    .createInstance(Ci.nsIPrefLocalizedString);
            temp.data = this.getUrlSpec('Saxon');
            this.prefs.setComplexValue('extensions.xslresults.'+Saxonjardirtype, Ci.nsIPrefLocalizedString, temp);
            Saxonjardir = temp.data;
        }
        if (Saxonjardir.indexOf('file:///') !== 0) {
            Saxonjardir = 'file:///'+Saxonjardir;
        }
        */
        var saxon_load_complete = true;
//        var Saxonjardir_substr = Saxonjardir.substring(8);
        var saxonjardir = this.extdir.getItemFile(this.extid, 'Saxon');
        if (saxonjardir.exists()) {
            var saxonjarfile = this.extdir.getItemFile(this.extid, 'Saxon/SaxonWrapper.jar');
            if (saxonjarfile.exists()) {
                var saxonjar = this.getUrlSpec('Saxon/SaxonWrapper.jar'); // extpath+'Saxon'+this.OSfile_slash+'SaxonWrapper.jar';
                fURL[0] = new java.net.URL(saxonjar);
                var URLstocycle = ['saxon9.jar', 'saxon9-dom4j.jar', 'saxon9-dom.jar', 'saxon9-jdom.jar', 'saxon9-s9api.jar', 'saxon9-sql.jar', 'saxon9-xom.jar', 'saxon9-xpath.jar', 'saxon9-xqj.jar'];
                var tempjar;
                for (var i=0; i < URLstocycle.length; i++) {
                    tempjar = this.extdir.getItemFile(this.extid, 'Saxon/'+URLstocycle[i]);
                    if (tempjar.exists()) {
                        fURL[i+1] = new java.net.URL(this.getUrlSpec('Saxon/'+URLstocycle[i]));
                    }
                    else {
                        alert(this.strbundle.getString('extensions.xslresults.filenotfound')+' '+tempjar.path);
                        saxon_load_complete = false;
                        break;
                    }
                }
            }
            else {
                alert(this.strbundle.getString('extensions.xslresults.filenotfound')+' '+saxonjarfile.path);
                saxon_load_complete = false;
            }
        }
        else {
            if (this.prefs.getIntPref('extensions.xslresults.enginetype') === 0) {
                alert(this.strbundle.getString('extensions.xslresults.dirnotfound')+' '+saxonjardir.path);
            }
            saxon_load_complete = false;
        }
        this.fURL = null;
        if (saxon_load_complete) {
            fURL[i+1] = new java.net.URL(this.getUrlSpec('utils/firefoxClassLoader.jar'));
//            fURL = this.toUrlArray(fURL);
            this.xslresults_loader_saxon = new java.net.URLClassLoader(fURL);
            this.fURL = fURL;
        }
        else {
            this.xslresults_loader_saxon = false;
        }
    /*
    }
    else {
        alert(this.strbundle.getString('extensions.xslresults.unrecognizedOS'+': '+navigator.platform));
        return;
    }
  */


        this.performXSL.loader_saxon = this.xslresults_loader_saxon;
        this.startLoadListeners();
    },
    docEvaluateArray : function (expr, doc, context, resolver) {
        doc = doc ? doc : document;
        resolver = resolver ? resolver : null;
        context = context ? context : doc;

        var result = doc.evaluate(expr, context, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var a = [];
        for(var i = 0; i < result.snapshotLength; i++) {
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
                    // If user wants to auto-apply XSLT 2.0 processing instructions, do so

                    /*
                    if (that.prefs.getBoolPref('extensions.xslresults.applyXSLT') ||
                            that.prefs.getBoolPref('extensions.xslresults.applyXSLT2')) {
                    }
                    */
    /*                           if (PHP.in_array(e.originalTarget.contentType,  // We make the faulty assumption that the result will be XML (so we don't need to test every single HTML document the browser loads
                                    ['text/xml', 'application/xml', 'application/xhtml', 'text/xsl', 'application/xslt+xml']
                      )) {*/

                    if (PHP.in_array(e.originalTarget.contentType,  // We make the faulty assumption that the result will be XML (so we don't need to test every single HTML document the browser loads
                                    ['text/xml', 'application/xml', 'application/xhtml', 'text/xsl', 'application/xslt+xml']) ||
                        PHP.in_array(href.substring(href.lastIndexOf('.')+1),  /* We make the faulty assumption that the file determines whether it was originally XML (so we don't need to test every single HTML document the browser loads */
                                    ['xml', 'rdf', 'xhtml', 'xsl', 'svg']
                      )) {
                        var i, pis;
                        if (that.prefs.getBoolPref('extensions.xslresults.applyXSLT') ||
                                that.prefs.getBoolPref('extensions.xslresults.applyXSLT2')
                            ) {
    //                                    var xsl = '';

                            var cb0 = function (buf) { // Gets XML
                            var wininfo = that.performXSL.getWindowContent(window);
                            if ((wininfo.ctype === 'xml' && that.prefs.getBoolPref('extensions.xslresults.xmlstripdtd')) ||
                                        (wininfo.ctype=== 'html' && that.prefs.getBoolPref('extensions.xslresults.htmlstripdtd'))) {
                                buf = buf.replace(/<!DOCTYPE[^>\[]*\[[^\]]*\]>/g, '').replace(/<!DOCTYPE[^>]*>/g, '');
                            }
                            pis = that.docEvaluateArray('/processing-instruction("xml-stylesheet")', e.originalTarget);

                            for (i=0; i < pis.length; i++) {
                                var results = pis[0].nodeValue.match(/(^|\s+)type\s*=\s*(['"])([^'"]*)\2/);
                                var type = results[3];

                                if ((PHP.in_array(type, ['text/xsl', 'application/xml', 'application/xslt+xml']) &&
                                      that.prefs.getBoolPref('extensions.xslresults.applyXSLT')) ||
                                        (type === 'application/xslt+xml' &&
                                          that.prefs.getBoolPref('extensions.xslresults.applyXSLT2'))
                                    ) {

                                    var results2 = pis[0].nodeValue.match(/(^|\s+)href\s*=\s*(['"])([^'"]*)\2/);
                                    var absHref = results2[3];
                                    if (!absHref.match(/^(https?|file):\/\//)) {
                                        absHref = e.originalTarget.documentURIObject.resolve(absHref);
                                    }
                                    var cb1 = function (stylesheet) {
                                        var cb2 = {
                                            processResult : function (data, ext) {
                                                /*if (textbox) {
                                                      data = '<textarea cols="100%" rows="40">'+data+'</textarea>';
                                                      ext = 'html';
                                                }*/
                                                /*
				var where = that.prefs.getBoolPref('extensions.xslresults.open_where');
                                                if (where === 'open_window') {
                                                      that.openfile(data, ext); // works to open a new window
                                                }
					else if (where === 'open_tab') {
						that.openTab(data, ext);
					}
                                                else {
                                                */
                                                  // var charset = newDocument.characterSet; // Do we really need to do this?
                                                var charset = 'UTF-8';
                                                var filepath = this.writeFile(data, ext, charset); // Any way (or need) to dynamically change extension here?
                                                e.originalTarget.location.href = filepath;
                                                // }
                                            }
                                        };

                                        that.performXSL.finish(stylesheet, buf, cb2, 0); // 0 is Saxon, 1 is Transformiix
                                    };
                                    that.performXSL.getPrestyleDoc(absHref, null, null, 'UTF-8', cb1, true);
                                }
                            }
    //                      var wininfo = that.performXSL.getWindowContent(e.target.defaultView); // defaultView grabs window owner of this document
    //                      that.performXSL.getDataForXSL(wininfo.content, xsl, cbo);
                        }
                        that.performXSL.getPrestyleDoc(href, null, null, 'UTF-8', cb0, true); // window.content.document.characterSet
                    }
                } // <?xml-stylesheet href="abc" type="text/xsl"?>
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
        }, false);
    },
    getUrlSpec : function (myfile) {
        // returns nsIFile for the given extension's file
        var file = this.extdir.getItemFile(this.extid, myfile);
        var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
        var url = ios.newFileURI(file);
        return url.spec;
    },
/*
 toUrlArray : function(a) { // from http://simile.mit.edu/repository/java-firefox-extension/firefox/chrome/content/scripts/browser-overlay.js
    var urlArray = java.lang.reflect.Array.newInstance(java.net.URL, a.length);
    for (var i = 0; i < a.length; i++) {
        var url = a[i];
        java.lang.reflect.Array.set(
            urlArray,
            i,
            (typeof url == 'string') ? new java.net.URL(url) : url
        );
    }
    return urlArray;
  },
*/
    policyAdd : function (loader, urls) {
        // The following code was adapted from http://simile.mit.edu/wiki/Java_Firefox_Extension
        //var bootstrapClassLoader = java.net.URLClassLoader.newInstance([ firefoxClassLoaderURL ]);
        var policyClass = java.lang.Class.forName(
            'edu.mit.simile.firefoxClassLoader.URLSetPolicy',
            true,
            loader
        );
        var policy = policyClass.newInstance();
        policy.setOuterPolicy(java.security.Policy.getPolicy());
        java.security.Policy.setPolicy(policy);
        policy.addPermission(new java.security.AllPermission());

        for (var j=0; j < urls.length; j++) {
            policy.addURL(urls[j]);
        }
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
			var where = that.prefs.getCharPref('extensions.xslresults.open_where');
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
    onViewResultantSaxonSource : function () {
        if(!this.performXSL.javaenabled()) {
          return;
        }
        this.onViewResultantSource(0);
    },
    onViewResultantTransformiixSourceTextBox : function () {
        this.onViewResultantSource(1, true);
    },
    onViewResultantSaxonSourceTextBox : function () {
        if(!this.performXSL.javaenabled()) {
            return;
        }
        this.onViewResultantSource(0, true);
    },
    onViewResultantSource : function (enginetype, textbox) {
        var that = this;
        var href = window.content.location.href;

        // 1) Grab original raw XML with stylesheet
        var wininfo = that.performXSL.getWindowContent(window);

        var cb0 = function (buf) { // Gets XML
            if ((wininfo.ctype === 'xml' && that.prefs.getBoolPref('extensions.xslresults.xmlstripdtd')) ||
                  (wininfo.ctype=== 'html' && that.prefs.getBoolPref('extensions.xslresults.htmlstripdtd'))) {
              buf = buf.replace(/<!DOCTYPE[^>\[]*\[[^\]]*\]>/g, '').replace(/<!DOCTYPE[^>]*>/g, '');
            }
            // 2) Use stylesheet to get raw XSL
            var xslt2re = /<\?xml-stylesheet[^>]*?\s+(href\s*=\s*['"]([^\s]+)['"]\s+)?type\s*=\s*['"](application\/xslt\+xml|text\/xsl)['"]\s*[^>]*?(href=\s*['"]([^\s]+)['"])?[^>]*\?>/g;
            var xslt2prinst;
            var stylesheet = false;
            var stylesheetURL = false;
            while ((xslt2prinst = xslt2re.exec(buf)) != null) {
                stylesheet = xslt2prinst[2] ? xslt2prinst[2] : (xslt2prinst[5] ? xslt2prinst[5] : false);
                if (stylesheet) {
                        stylesheetURL = stylesheet;
                        if (!stylesheet.match(/^(https?|file):\/\//)) {
                                stylesheetURL = window.getBrowser().selectedBrowser.webNavigation.currentURI.resolve(stylesheet);
                        }
                        break;
                }
            }
            var cb1 = function (stylesheet) {
                // 3) apply XSL to XML
//                          alert(stylesheet);
                          //var stylesheetDOM = new DOMParser().parseFromString(stylesheet, 'application/xml');
//                          alert(new XMLSerializer().serializeToString(stylesheetDOM));
/*
                          var processor = new XSLTProcessor();
                          try {
                                  processor.importStylesheet(stylesheetDOM);
                          }
                          catch(e) {
                                  alert(e);
                                  return;
                          }*/
                          //var xmldoc = new DOMParser().parseFromString(buf, 'application/xml');
                          //var newDocument = processor.transformToDocument(xmldoc);
                          //var content = new XMLSerializer().serializeToString(newDocument);
                var cb2 = {
                    processResult : function (data, ext) {
                        if (textbox) {
                            data = '<textarea cols="100%" rows="40">'+data+'</textarea>';
                            ext = 'html';
                        }
						var where = that.prefs.getBoolPref('extensions.xslresults.open_where');
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

                that.performXSL.finish(stylesheet, buf, cb2, enginetype); // 0 is Saxon, 1 is Transformiix
            };
            if (stylesheetURL) {
                this.performXSL.getPrestyleDoc(stylesheetURL, null, null, 'UTF-8', cb1, true);
            }
            else {
                alert('No stylesheet was found');
            }
    // this.performXSL.getPrestyleDoc(href, xsl, cbo, window.content.characterSet, null, true); // Grab with stylesheet data
        };
        this.performXSL.getPrestyleDoc(href, null, null, 'UTF-8', cb0, true); // window.content.document.characterSet
    },
    // Not in use (probably should transfer option for putting data in textbox to above
    onViewResultantSourceTextbox: function(e) {
        var wininfo = this.performXSL.getWindowContent(window);
        var data = wininfo.content;
        /* in Java code, use getUnderlyingCompiledStylesheet() on XsltExecutable and then getOutputProperties() to find out xsl:output
        var xslt2re = /<\?xml-stylesheet[^>]*type="application\/xslt\+xml"[^>]*\?>/g;
        var xslt2prinsts = data.match(xslt2re);
        if (xslt2prinsts !== null) {
            for (var i=0; i < xslt2prinsts.length; i++) {
                if (this.loader_saxon && furl) {
                    this.policyAdd(this.xslresults_loader_saxon, this.fURL);

                    alert(xslt2prinsts[i]);

                    try {
                        var SaxonWrapper = this.xslresults_loader_saxon.loadClass('SaxonWrapper');
                        var sw = SaxonWrapper.newInstance();
                        var serializ = new XMLSerializer();
                        stylesh = serializ.serializeToString(stylesh);
                        data = sw.xform(stylesh, xmldata, method); // 'html'
                    }
                    catch (e) {
                    }
                }
            }
        }
        //*/
        /*
        ('chrome://xquseme/content/querydialog.xul', 'xsl-win', 'chrome, resizable, scrollbars, minimizable, centerscreen');
        win.focus();
        */
        var win = window.openDialog(); // plain window.open doesn't work right
        var doc = win.document;
        doc.open();
        // <?xml-stylesheet type="application/xslt+xml" href="xsl.xsl" ?>

        // '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd"><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Output</title></head>' +
        data = '<textarea cols="100%" rows="40">'+data+'</textarea>';
        // + '</body></html>';
        doc.writeln(data);
        doc.close();
    },
    viewSource : function () {
        // From chrome://browser/content/browser.xul
        BrowserViewSourceOfDocument(content.document);
    },
    onMenuItemCommand: function(e) {
        if(!this.performXSL.javaenabled()) {
            return;
        }
        // Open and focus on query window, sending the current document and the URL Class loader data
        var wininfo = this.performXSL.getWindowContent(window);
        var ctype = wininfo.ctype;
        var conttype = wininfo.contentType;
        var data = wininfo.content;

        var xsldialog = window.openDialog('chrome://xslresults/content/getxsldata.xul', 'getxsldata',
                 'chrome, resizable, scrollbars, minimizable', /* centerscreen,  */ data, this.xslresults_loader_saxon,
                 this.fURL, ctype, conttype);
        xsldialog.focus();
    },
    performXSL : performXSL
};

this.xslresults = xslresults;

}());

window.addEventListener("load", function(e) {
    performXSL.onLoad(e);
    xslresults.onLoad(e);
}, false);
