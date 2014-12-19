/*globals Components, XMLSerializer, DOMParser, XSLTProcessor, HTMLDocument, XMLDocument, XPathResult*/
/*jslint vars:true, bitwise:true*/
(function () {'use strict';

var Cc = Components.classes;
var Ci = Components.interfaces;

var $ = function (id, doc) {
    if (!doc) {
        doc = document;
    }
    return doc.getElementById(id);
};

/* From: Comment of Mark Wubben: http://simonwillison.net/2006/Jan/20/escape/  */
var regexEscape = (function() {
    var specials = [
        '/', '.', '*', '+', '?', '|',
        '(', ')', '[', ']', '{', '}', '\\',
        '^', '$'
    ];
    var sRE = new RegExp(
        '(\\' + specials.join('|\\') + ')', 'g'
    );
    return function(text) {
        return text.replace(sRE, '\\$1');
    };
}());

var performXSL = {
    onLoad : function () {

        this.strbundle = $('xslresults-strings');

        this.prefs = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService);
        this.branch = this.prefs.getBranch('extensions.xslresults.');

        var extid = 'xslresults@brett.zamir'; // the extension's id from install.rdf
        Components.utils['import']('resource://gre/modules/AddonManager.jsm');
        // the path may use forward slash ('/') as the delimiter
        var that = this;
        AddonManager.getAddonByID(extid, function (addon) {
            that.addon = addon;
        });

        this.OS = this.searchString(this.dataOS);
        this.OSfile_slash = (this.OS === 'Windows') ? '\\' : '/'; // The following doesn't seem to auto-convert forward slashes to backslashes, so this is needed
    },
    getWindowContent : function (win) {
        // NOTE: I changed to window.opener below as this will work from window (and also seems to work fine even from main extension overlay)
        // Get current window's content (in component, could get from any window)
        var mainWindow = win.QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIWebNavigation)
                     .QueryInterface(Ci.nsIDocShellTreeItem)
                     .rootTreeItem
                     .QueryInterface(Ci.nsIInterfaceRequestor)
                     .getInterface(Ci.nsIDOMWindow);
        var ser = new XMLSerializer();
        var windowcode = ser.serializeToString(mainWindow.content.document);
        return this.getWindowInfo(windowcode, mainWindow.content.document.contentType);
    },
    getWindowInfo: function(content, contentType) {
        var ctype = 'xml';
        var xhtmlashtml = false;
        switch (contentType) {
            case 'text/plain':
            case 'text/html':
                ctype = 'html';
                if (content.match(/<!DOCTYPE([^>]*)XHTML/)) { // Consider XHTML served as text/html to be XML for sake of DTD stripping since its DTD should be XML-style
                    ctype = 'xml';
                    xhtmlashtml = true; // But will need clean up
                }
                break;
            case 'text/xml':
            case 'application/xml':
            case 'application/xhtml+xml':
                ctype = 'xml';break;
            default:
                ctype = 'xml';break;
        }

        // Convert imperfect HTML into well-formed XML, basing it off of Firefox's DOM representation of HTML documents
        // Fix: Todo - deal with malformedness due to double hyphens elsewhere within a comment
        if (ctype === 'html' || xhtmlashtml) { // Only reduce to capital letters when invoking for HTML (due to bug in Firefox)
            content = content.replace(
                    /<([^!>\s]+)(\s|>)/g,
                    function(tag, tagname, end) {
                        return '<'+tagname.toLowerCase()+end;
                    }
                ).replace(
                    // Will this work with CDATA? Seems to work ok because of Firefox's DOM conversion process...
                    /<!DOCTYPE(\s+)([^>\s]*)([\s>])/g,
                    function (whole, ws1, root, ws2) {
                        return '<!DOCTYPE' + ws1 + root.toLowerCase() + ws2;
                    }
                );
            // Deal with multiple hyphens inside of a comment, since Firefox's DOM parser doesn't fix these
            var hyph_comm_patt = /<!--([^>]*)--+([^>])/g;
            while (content.match(hyph_comm_patt)) {
                content = content.replace(hyph_comm_patt, '<!--$1 - $2');
            }
            content = content.replace(
                // Firefox allows comments with extra hyphens to display in HTML (including in its inner DOM representation), but will not be valid as XML.
                /<!--(-*)([^>]*[^>\-])(-*)-->/g, '<!--$2-->'
            ).replace(
                // Overcome a few known obfuscation techniques used at some sites to prevent querying:
                /<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD HTML 4\.01 Transitional\/\/EN">/g,
                '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">'
            ).replace(
                // Deobfuscation
                /\s\)=""/g, ''
            );
            // content = content.replace(/(\<[^>]*)(\$)([^>]*\>)/g, '$1>'); // was overly aggressive
        }

        if ((ctype === 'xml' && this.branch.getBoolPref('xmlstripdtd')) ||
                (ctype === 'html' && this.branch.getBoolPref('htmlstripdtd'))) {
            content = content.replace(/<!DOCTYPE[^>\[]*\[[^\]]*\]>/, '');
            content = content.replace(/<!DOCTYPE[^>]*>/, '');
        }
        return {ctype:ctype, content:content, contentType: contentType};
    },
    docEvaluateArray : function (expr, doc, context, resolver) {
        doc = doc || document;
        resolver = resolver || null;
        context = context || doc;

        var result = doc.evaluate(expr, context, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        var a = [];
        var i;
        for (i = 0; i < result.snapshotLength; i++) {
            a[i] = result.snapshotItem(i);
        }
        return a;
    },
    xulResolver : function () {
         return 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul';
     },
    findMatchedURL : function (currurl, doc, assignCB, ignoreEnable) {
        if (!doc) {
            return false; // If not data
        }
        var urls = this.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[2]/@label', doc, doc,
                                this.xulResolver);
        var xsls = this.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[3]/@label', doc, doc,
                                this.xulResolver);
        var fileexts = this.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[4]/@label', doc, doc,
                                this.xulResolver);
        var enableds = this.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[5]/@value', doc, doc,
                                this.xulResolver);
        var prestyles = this.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[6]/@value', doc, doc,
                                this.xulResolver);
        var i, url, regexp;
        for (i = 0; i < urls.length; i++) {
            url = urls[i].nodeValue;
            regexp = new RegExp('^'  +  regexEscape(url).replace(/\\\*/g, '.*')   +  '\\/?$',  '');
            // if (url.match(/slashdot/)) {
                // alert('^'  +  regexEscape(url).replace(/\*/g, '.*')   +  '\/?$');return false;
            // }
            if ((ignoreEnable || enableds[i].nodeValue === 'true') && currurl.match(regexp)) {
                    assignCB(xsls[i].nodeValue.replace(/\\\\n/g, '\n'), fileexts[i].nodeValue, (prestyles[i].nodeValue === 'true'));
                    return true;
            }
        }
        return false;
    },
    saveFile: function () { // text
    },
    writeFile : function (content, outputext, charset) {
        charset = charset || 'UTF-8';
        var file = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('TmpD', Ci.nsIFile);

        if (!outputext) {
            outputext = this.branch.getComplexValue('outputext', Ci.nsIPrefLocalizedString).data;
            if (outputext === '') {
                outputext = 'xml';
            }
        }

        file.append('xslresult.' + outputext);
        file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt('0664', 8));

        var foStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
                // use 0x02 | 0x10 to open file for appending.
        foStream.init(file, 0x02 | 0x08 | 0x20, parseInt('0664', 8), 0); // write, create, truncate
        var os = Cc['@mozilla.org/intl/converter-output-stream;1'].createInstance(Ci.nsIConverterOutputStream);
        os.init(foStream, charset, 0, 0x0000);
// This assumes that foStream is the nsIOutputStream you want to write to
// 0x0000 instead of '?' will produce an exception: http://www.xulplanet.com/references/xpcomref/ifaces/nsIConverterOutputStream.html
// If charset in xsl:output is ISO-8859-1, the file won't open--if it is GB2312, it will output as UTF-8--seems buggy or?
        os.writeString(content);
        // etc.
        os.close();
        foStream.close();
        return 'file:///'+file.path;
    },
    loadfile : function(file, charset) {
        if (typeof file === 'string') {
            var tempfilename = file;
            file = Cc['@mozilla.org/file/directory_service;1'].
                                        getService(Ci.nsIProperties).
                                        get('ProfD', Ci.nsILocalFile);
            file.append(tempfilename);
        }
        if(!file.exists() ) {   // if it doesn't exist, create  // || !file.isDirectory()
            file.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt('0777', 8)); // DIRECTORY_TYPE
        }

        charset = charset || 'UTF-8';
        // From http://developer.mozilla.org/en/docs/Reading_textual_data
        // First, get and initialize the converter
        var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                                  .createInstance(Ci.nsIScriptableUnicodeConverter);
        converter.charset = charset; // 'UTF-8'; // The character encoding you want, using UTF-8 here

        // This assumes that 'file' is a variable that contains the file you want to read, as an nsIFile
        var fis = Cc['@mozilla.org/network/file-input-stream;1']
                            .createInstance(Ci.nsIFileInputStream);
        fis.init(file, -1, -1, 0);
        var lis = fis.QueryInterface(Ci.nsILineInputStream);
        var lineData = {};
        var cont;
        var line, lines = '';
        do {
            cont = lis.readLine(lineData);
            line = converter.ConvertToUnicode(lineData.value);
            // Now you can do something with line
            lines += line + '\n';
        } while (cont);
        fis.close();
        return lines;
    },
    openTab : function (content, ext) {
        var filepath = this.writeFile(content, ext);
        window.opener.getBrowser().selectedTab = window.opener.getBrowser().addTab(filepath, null, null);
        window.opener.focus();
    },
    openfile : function(content, ext) {
        var filepath = this.writeFile(content, ext);
        var win = window.open(
            filepath,
            'xslresultswin',
            'menubar=yes,location=yes,status=yes,resizable,scrollbars,minimizable' // chrome
        );
    },
    // fix: add use?
    testwellformed: function(xmldoc) {
        var parser = new DOMParser();
        var xmltest = parser.parseFromString(xmldoc, 'application/xml');
        if (xmltest.documentElement.nodeName === 'parsererror' && ($('xslcontent').value.match(/doc\(\)/) || $('xslcontent').value.match(/collection\(\)/))) { // Don't report parsing error if the XSL doesn't rely on the default
            alert(this.strbundle.getString('extensions.xslresults.err.parsexml'));
            return false;
        }
        return true;
    },
    getDataForXSL : function (content, xsl, cbo) {
        // allow button to get XML pre-conversion
        // Could add detection for XSL xml-stylesheets here if user opted to get pre-conversion content (but using that doc instead of e.target, etc.)
        // Do for XSL program, allow conversions of stylesheet via context menu
        this.finish(xsl, content, cbo);
    },
    getPrestyleDoc : function (url, xsl, cbo, charset, cb2, keepstyles) {
        var that = this;
        var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
        var uri = ios.newURI(url, charset, null);
        var channel = ios.newChannelFromURI(uri);
        var observer = {
            onDataAvailable : function(request, context, inputStr, offset, count) {
                // Code from http://developer.mozilla.org/en/docs/Reading_textual_data
                // var charset = 'UTF-8'; // Fix: Need to find out what the character encoding is. Using UTF-8 for this example
                // alert(charset);
                var is = Cc['@mozilla.org/intl/converter-input-stream;1'].createInstance(Ci.nsIConverterInputStream);
                // This assumes that fis is the nsIInputStream you want to read from
                is.init(inputStr, charset, 1024, 0xFFFD);
                if (is instanceof Ci.nsIUnicharLineInputStream) {
                    var line = {};
                    var cont;
                    do {
                        cont = is.readLine(line);
                        this.buf += line.value+'\n';
                        // Now you can do something with line.value
                    } while (cont);
                }
            },
            onStartRequest : function (req, context) {},
            onStopRequest : function (req, context) {
                // Should this first line even be there?
                if (!keepstyles) {
                    this.buf = this.buf.replace(/<\?xml-stylesheet[^>]*type\s*=\s*(["'])[^\s'"]*(xsl|application\/xml)[^'"]*\1[^>]*\>/, ''); // If converting to DOM, could just remove first children which are XSL xml-stylesheet's until root
                //this.buf = this.buf.replace(/&lt;\?xml-stylesheet[^&]*type\s*=\s*(['"'])[^\1]*(xsl|application\/xml)[^\1]*\1[^>]*&gt;/, ''); // If converting to DOM, could just remove first children which are XSL xml-stylesheet's until root
                }
                if (cb2) {
                    cb2(this.buf);
                    //cb2.call(that, this.buf); // Apply 'this' to current context
                }
                else {
                    var wininfo = that.getWindowInfo(this.buf, 'text/xml'); // We'll treat as though the original were XML (could have been true XHTML though)
//                    alert(wininfo.content);
                    that.getDataForXSL(wininfo.content, xsl, cbo);
                }
            },
            buf : ''
        };
        channel.asyncOpen(observer, null);
    },
    execute_XSL : function () {
        var xsl = $('xslcontent').value;
        var xmldata = $('xmlcontent').value;
        var cbo = {
            processResult : function (content, ext) {
                $('xmloutput').value = content;
				var where = this.branch.getCharPref('open_where');
                if (where === 'open_window') {
                    this.openfile(content, ext);
                }
                else if (where === 'open_tab') {
                    this.openTab(content, ext);
                }
            }
        };
        if (xmldata.match(/<HTML/)) {
            xmldata = xmldata.replace(
                /<([^!>\s]+)(\s|>)/g,
                function(tag, tagname, end) {
                    return '<'+tagname.toLowerCase()+end;
                }
            );
        }

        // XML content
        //if (xslfilename.match(/^\s*$/) || (xsl !== this.defaultxsl && !xsl.match(/^\s*$/))) {

        this.finish(xsl, xmldata, cbo);

        //progressmeter.style.display = 'none';
        //acceptbutton.disabled = false;

        //alert(xmldata);
        // return false;
        //}
    },
    finish : function(/* String or DOM */ stylesh, /* String */ xmldata, /* callback object*/ cbo, enginetype) {
        var parser;
        if (typeof stylesh === 'string') {
            parser = new DOMParser();
            stylesh = parser.parseFromString(stylesh, 'application/xml');
        }
        var xn1;
        try {
            xn1 = stylesh.getElementsByTagNameNS('http://www.w3.org/1999/XSL/Transform', 'stylesheet')[0].childNodes;
        }
        catch (e){
            alert(this.strbundle.getString('extensions.xslresults.err.xslpoorlyformed'));
            return;
        }

        var hasoutput = false;
        var j, method, xndChild;
        for (j = 0; j < xn1.length; j++) {
            xndChild = xn1[j];
            if (xndChild.localName === 'output' && xndChild.namespaceURI === 'http://www.w3.org/1999/XSL/Transform' &&
                  xndChild.hasAttribute('method')) {
                method = xndChild.getAttribute('method');
                hasoutput = true;
                break;
            }
        }

        var extension;
        var hasext = false;

        if (hasoutput) {
            if (method === 'html') {
                extension = 'html';
                hasext = true;
            }
            else if (method === 'xml') {
                extension = 'xml';
                hasext = true;
            }
            else if (method === 'text') {
                extension = 'txt';
                hasext = true;
            }
            else {
                hasext = false;
            }
        }
        else {
            method = 'xml';
            extension = 'xml';
        }
        var engineUndefined = false;
        if (enginetype === undefined) {
            enginetype = this.branch.getIntPref('enginetype');
            engineUndefined = true;
        }
        var data;
        // Transformiix (Firefox built-in XSL engine)
        if (enginetype === 1) {
            var processor = new XSLTProcessor();

            try {
                processor.importStylesheet(stylesh);
            }
            catch(e) {
                alert(e);
                return;
            }

            parser = new DOMParser();
            var xmldoc = parser.parseFromString(xmldata, 'application/xml');
            if (xmldoc.documentElement.nodeName === 'parsererror') {
                alert(this.strbundle.getString('extensions.xslresults.err.parsexml'));
                return;
            }

            var newDocument = processor.transformToDocument(xmldoc);

            //********* This is the correct form to use, but the file writing stream doesn't see to like it in some cases--see notes below ************
            // var charset = newDocument.characterSet;
            // var charset = 'UTF-8';

            if (!hasext) {
                if (typeof newDocument === 'object' && newDocument instanceof XMLDocument) {
                    extension = 'xml';
                }
                else if (typeof newDocument === 'object' && newDocument instanceof HTMLDocument) {
                    extension = 'html';
                }
                else {
                    extension = 'xml'; // How did it get here?
                }
            }

/*
            // Had the following default rules earlier as an attempt to follow http://www.w3.org/TR/xslt#output , but not needed with the above (though Firefox seems to ignore the rule about not considering the type as HTML if there is non-whitespace text before the HTML element
            if (!hasext && newDocument.hasChildNodes()) {
                n1 = newDocument.childNodes;
                for (var i=0; i < n1.length; i++) {
                    ndChild = n1[i];

                    alert(ndChild.nodeType);

                    var childlocalname = ndChild.localName.toLowerCase();

                    if (ndChild.nodeType === Node.TEXT_NODE && ndChild.nodeValue.search(/\S/) !== -1) {
                        extension = 'xml';
                        break;
                    }
                    else if (ndChild.nodeType === Node.ELEMENT_NODE && childlocalname === 'html' && ndChild.namespaceURI === null) {
                        extension = 'html';
                        break;
                    }
                    extension = 'xml';
                }
            }
            else if (!hasext) {
                extension = 'xml';
            }
            */
            var s = new XMLSerializer();
            data = s.serializeToString(newDocument);

            // Hackish, but works:
            data = data.replace('<transformiix:result xmlns:transformiix="http://www.mozilla.org/TransforMiix">', '');
            data = data.replace('</transformiix:result>', '');
            if (data === '') {
                alert(this.strbundle.getString('extensions.xslresults.err.nocontent'));
                return;
            }
            if (!engineUndefined) {
                data = this.getWindowInfo(data, newDocument.contentType).content;
            }
        }
        var outputext = this.branch.getComplexValue('outputext', Ci.nsIPrefLocalizedString).data;

        if (outputext !== '') {
            extension = outputext; // 'extension' will otherwise be as determined above
        }
        cbo.processResult.call(this, data, extension); // Apply 'this' to current context
    },
    // Adapted a portion of script from http://www.quirksmode.org/js/detect.html used here for OS detection
    searchString: function (data) {
        var i, dataString;
        for (i = 0; i < data.length; i++) {
            dataString = data[i].string;
            if (dataString) {
                if (dataString.indexOf(data[i].subString) !== -1) {
                    return data[i].identity;
                }
            }
        }
        return false;
    },
    dataOS : [
        {
            string: navigator.platform,
            subString: 'Win',
            identity: 'Windows'
        },
        {
            string: navigator.platform,
            subString: 'Mac',
            identity: 'Mac'
        },
        {
            string: navigator.platform,
            subString: 'Linux',
            identity: 'Linux'
        }
    ]
};

// EXPORT
window.performXSL = performXSL;

}());