/*globals performXSL, AddonManager, Components, XMLSerializer, DOMParser, XSLTProcessor, XPathResult*/
/*jslint vars:true, bitwise:true*/
'use strict';
var Cc = Components.classes;
var Ci = Components.interfaces;

var $ = function (id, doc) {
    if (!doc) {
        doc = document;
    }
    return doc.getElementById(id);
};

function file_put_contents (file, data, charset) { // Fix: allow file to be placed outside of profile directory

    // Can be any character encoding name that Mozilla supports // Brett: Setting earlier, but even with a different setting, it still seems to save as UTF-8
    charset = charset || 'UTF-8';

    // the path may use forward slash ('/') as the delimiter

    if (typeof file === 'string') {
        var tempfilename = file;
        file = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('ProfD', Ci.nsILocalFile);
        file.append(tempfilename);
    }

    if (!file.exists()) {   // if it doesn't exist, create  // || !file.isDirectory()
        file.create(Ci.nsIFile.NORMAL_FILE_TYPE, parseInt('0777', 8)); // DIRECTORY_TYPE
    }
    // file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0664); // for temporary

    var foStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
    foStream.init(file, 0x02 | 0x08 | 0x20, parseInt('0664', 8), 0); // use 0x02 | 0x10 to open file for appending.
    // foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate

    var os = Cc['@mozilla.org/intl/converter-output-stream;1']  .createInstance(Ci.nsIConverterOutputStream);
    // This assumes that foStream is the nsIOutputStream you want to write to
    // 0x0000 instead of '?' will produce an exception: http://www.xulplanet.com/references/xpcomref/ifaces/nsIConverterOutputStream.html
    // If charset in xsl:output is ISO-8859-1, the file won't open--if it is GB2312, it will output as UTF-8--seems buggy or?
    os.init(foStream, charset, 0, 0x0000);
    os.writeString(data);
    os.close();
    foStream.close();
}

var executeXSL = {
    loadPageXSL : function () {
        var currurl = window.opener.getBrowser().selectedBrowser.webNavigation.currentURI.spec;
        function assignCB (xsl, fileext) {
            $('xslcontent').value = xsl;
            $('outputext').value = fileext;
        }
        if (!this.performXSL.findMatchedURL(currurl, this.xmlDoc, assignCB, true)) {
            alert(this.strbundle.getString('extensions.xslresults.loadPageXSLError'));
        }
    },
    updateURL : function (urlval) {
        var val = urlval;
        var linksize = 40;
        if (urlval.length > linksize) {
            val = urlval.substring(0, linksize-4)+'...';
        }
        $('link').innerHTML = val;
        $('link').setAttribute('href', urlval);
    },
    updateTreeOnChange : function (e) {
        var t = $('querytree');
        var colname = e.target.id.replace('xmlSitePref.', '');
        if (!t.columns) {
            return;
        }
        var col = t.columns.getNamedColumn('query'+colname);
        var val = e.target.value;
        if (colname === 'url') {
            this.updateURL(e.target.value);
        }
        else if (colname === 'xsl') {
            val = e.target.value.replace(/\n/g, '\\\\n');
        }
        if (t.currentIndex === -1) {
            return;
        }
        try {
            t.view.setCellText(t.currentIndex, col, val);
        }
        catch(ignore) {
        }
        t.view.setCellText(t.currentIndex, col, val);
        this.updateView();
        //                alert(this.serialize(this.xmlDoc));
    },
    updateView : function () {
        if (typeof this.xmlDoc === 'string' && (!this.xmlDoc || this.xmlDoc.match(/^\s*$/))) {
            this.xmlDoc = document.implementation.createDocument(null, '', null);
            var node = this.xmlDoc.importNode($('treechildren'), true);
            this.xmlDoc.appendChild(node);
        }
        else {
            try {
                this.xmlDoc.replaceChild($('treechildren').cloneNode(true), this.xmlDoc.getElementById('treechildren'));
            }
            catch (ignore) {
            }
        }
        file_put_contents ('xslresults_querydata.xml', this.serialize(this.xmlDoc)); // Added here to ensure had latest when relying on DOMContentLoaded
    },
    moveToMainWindow : function () {
        $('xslcontent').value = $('xmlSitePref.xsl').value;
        $('xsltabs').selectedIndex = 0;
    },
    newItem : function (useCurrent) {
        if (!useCurrent) {
            this.emptySitePrefFields();
        }
        var name = this.escapeXML($('xmlSitePref.name').value);
        var url = this.escapeXML($('xmlSitePref.url').value);
        var xsl = this.escapeXML($('xmlSitePref.xsl').value);

        $('treechildren').appendChild(this.DOMParse(
                '<treeitem xmlns="'+this.xulns+'"><treerow><treecell label="' + name + '"/><treecell label="' + url + '"/><treecell label="' + xsl + '"/>' +
                        '<treecell label="xml"/><treecell value="false"/><treecell value="false"/>'+
                                '</treerow></treeitem>' /* <treecell value="false"/><treecell value="false"/> */
              ).documentElement
        );

        var t = $('querytree');
        t.view.selection.select(t.view.rowCount - 1);
        t.focus();
        this.updateView();
    },
    escapeXML : function (xml) {
        return xml.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/, '&apos;').replace(/\n/g, '\\\\n');
    },
    emptySitePrefFields : function () {
        $('xmlSitePref.name').value = '';
        $('xmlSitePref.url').value = '';
        $('xmlSitePref.xsl').value = '';
    },
    deleteItem : function () {
        this.emptySitePrefFields();
        var t = $('querytree');
        if (!t.getElementsByTagNameNS(this.xulns, 'treeitem').length) {
            return;
        }
        var oldindex = t.currentIndex;
        var treeitem = t.view.getItemAtIndex(t.currentIndex);

        treeitem.parentNode.removeChild(treeitem);
        if (oldindex === 0) {
            t.view.selection.select(0);
        }
        else {
            t.view.selection.select(oldindex-1);
        }
        t.focus();
        $('link').innerHTML = '';
        this.updateView();
    },
    populateSitePrefBoxes : function (t) {
        if (t.currentIndex === -1) {
           return;
        }
        var url;
        try {
           url = t.view.getCellText(t.currentIndex, t.columns.getNamedColumn('queryurl'));
        }
        catch(e) {
            return;
        }
        $('xmlSitePref.url').value = url;
        var name = t.view.getCellText(t.currentIndex, t.columns.getNamedColumn('queryname'));
        $('xmlSitePref.name').value = name;

        var xsl = this.docEvaluate('//xul:treeitem/xul:treerow[xul:treecell[1]/@label = "'+name+'" and xul:treecell[2]/@label = "'+url+'"]/xul:treecell['+3+']/@label', document, t,
                                            this.performXSL.xulResolver);

        $('xmlSitePref.xsl').value = xsl.value.replace(/\\\\n/g, '\n');

        this.updateURL(url);
        this.updateView();
    },
    serialize : function (str) {
        try {
            return new XMLSerializer().serializeToString(str);
        }
        catch (e) {
            return '';
        }
    },
    DOMParse : function (xml) {
        return new DOMParser().parseFromString(xml, 'text/xml');
    },
    loadSitePrefsData : function () {
        // the path may use forward slash ('/') as the delimiter

        this.xmlDoc = this.performXSL.loadfile('xslresults_querydata.xml');
        if (typeof this.xmlDoc === 'string' && (!this.xmlDoc || this.xmlDoc.match(/^\s*$/))) {
            // New additions
            this.xmlDoc = document.implementation.createDocument(null, '', null);
            var node = this.xmlDoc.importNode($('treechildren'), true);
            this.xmlDoc.appendChild(node);
            return;
        }

        this.xmlDoc = new DOMParser().parseFromString(this.xmlDoc, 'text/xml');
        $('querytree').focus();
        var treechildren = this.xmlDoc.documentElement;
        this.replaceTreeChildren(treechildren.cloneNode(true)); // cloneNode still needed here?
    },
    replaceTreeChildren : function (treechildren) {
        var oldtreechildren = $('treechildren');
        oldtreechildren.parentNode.replaceChild(treechildren, oldtreechildren);
        window.setTimeout(
            function() {
                var t = $('querytree');
                if (!t.view) {
                    return;
                }
                t.view.selection.select(0);
                t.focus();
            }, 500
        );
    },
    docEvaluate: function (expr, doc, context, resolver) {
        doc = doc || document;
        resolver = resolver || null;
        context = context || doc;

        var result = doc.evaluate(expr, context, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        return result.snapshotItem(0);
    },
    sortFields: {},
    sort: function (col) {
        if (typeof this.xmlDoc === 'string' && (!this.xmlDoc || this.xmlDoc.match(/^\s*$/))) {
            // New additions
            this.xmlDoc = document.implementation.createDocument(null, '', null);
            var node = this.xmlDoc.importNode($('treechildren'), true);
            this.xmlDoc.appendChild(node);
            return;
        }
        var t = $('querytree');
        var colindex = t.columns.getColumnFor(col).index+1; // Get the true index (and up one for XPath selector)

        var sortAtt, sortField;
        sortAtt = 'label';
        sortField = col.getAttribute('label');

        var result = this.docEvaluate('//xul:treeitem[1]/xul:treerow[1]/xul:treecell['+colindex+']/@'+sortAtt+'[1]', document, t,
                                    this.performXSL.xulResolver);
        if (result == null) {
            sortAtt = 'value';
            sortField = col.getAttribute('value');
        }
        this.sortFields[sortField] = !this.sortFields[sortField];
        var order = 'descending';
        if (!this.sortFields[sortField]) {
            order = 'ascending';
        }

        var processor = new XSLTProcessor();
        var xsl = '<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:xul="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul" xmlns="http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul">'+
                            '<xsl:output method="xml" version="1.0" encoding="UTF-8"/><xsl:template match="/">'+
                            '<xul:treechildren id="treechildren">'+
                            '   <xsl:for-each select="xul:treechildren/xul:treeitem">'+
                            '         <xsl:sort select="xul:treerow/xul:treecell['+colindex+']/@'+sortAtt+'" order="'+order+'"/>'+
                            '         <xsl:copy-of select="."/>'+
                            '   </xsl:for-each>'+
                            '</xul:treechildren>'+
                            '</xsl:template></xsl:stylesheet>';

        xsl = new DOMParser().parseFromString(xsl, 'text/xml');
        processor.importStylesheet(xsl);

        // Set document for transform to reflect current view
        this.xmlDoc.replaceChild($('treechildren').cloneNode(true), this.xmlDoc.getElementById('treechildren'));

        var newDocument = processor.transformToDocument(this.xmlDoc);

        // Replace
        this.replaceTreeChildren(newDocument.documentElement.cloneNode(true));
        this.populateSitePrefBoxes(t);
    },      
    p: function(str) {
        console.log(str);
    },
    onLoad: function() {
        var that = this;
        $('querytree').addEventListener('blur', function(e) {that.populateSitePrefBoxes(e.target);}, true);

        // Set window size to that set last time hit 'ok''
        this.prefs0 = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefBranch);
        this.prefs = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService);
        // This branch must be set in both the properties file and prefs js file: http://developer.mozilla.org/en/docs/Code_snippets:Preferences#nsIPrefLocalizedString
        this.branch0 = this.prefs.getBranch('extensions.xslresults.');
        this.branch = this.prefs.getBranch('extensions.xslresults.');

        $('outputext').value = this.branch.getComplexValue('outputext', Ci.nsIPrefLocalizedString).data;

        // Might be able to change some of these to @persist?
        var outerh = this.branch0.getIntPref('window.outer.height');
        var outerw = this.branch0.getIntPref('window.outer.width');
        if (outerh > 0) {
            window.outerHeight = outerh;
        }
        if (outerw > 0) {
            window.outerWidth = outerw;
        }

        var outputw = this.branch0.getIntPref('xmlcontentbox.width');
        var outputw2 = this.branch0.getIntPref('xmloutputbox.width');
        if (outputw > 0) {
            $('xmlcontentbox').minwidth = outputw;
            $('xmlcontentbox').maxwidth = outputw;
            $('xmlcontentbox').width = outputw;
        }
        if (outputw2 > 0) {
            $('xmloutputbox').minwidth = outputw2;
            $('xmloutputbox').maxwidth = outputw2;
            $('xmloutputbox').width = outputw2;
        }

        if (this.branch0.getIntPref('textbox.xsl.width') > 0) {
            $('xslcontentbox').width = this.branch0.getIntPref('textbox.xsl.width');
        }
        if (this.branch0.getIntPref('textbox.xml.width') > 0) {
            $('xmlcontentbox').width = this.branch0.getIntPref('textbox.xml.width');
        }

        $('extensions.xslresults.enginetype').selectedIndex = this.branch.getIntPref('enginetype');

                
        $('extensions.xslresults.xmlstripdtd').checked = this.branch.getBoolPref('xmlstripdtd');
        $('extensions.xslresults.htmlstripdtd').checked = this.branch.getBoolPref('htmlstripdtd');
        $('extensions.xslresults.open_where').selectedItem = $(this.branch.getCharPref('open_where'));
        if ($('extensions.xslresults.open_where').selectedItem === $('open_textbox_only')) {
            $('outputext').disabled = true;
        }

        var extid = 'xslresults@brett.zamir'; // the extension's id from install.rdf
        Components.utils['import']('resource://gre/modules/AddonManager.jsm');
        // the path may use forward slash ('/') as the delimiter
        
        AddonManager.getAddonByID(extid, function (addon) {
            that.addon = addon;
            $('helppanel').setAttribute('src', that.getUrlSpec('readme.xhtml'));
        });

        var ctype = window.arguments[3];
        this.processDTD(ctype);
                
        var defaultxsl = this.branch.getComplexValue('defaultxsl', Ci.nsIPrefLocalizedString).data;

        if (defaultxsl !== ' ' && defaultxsl !== '') {
            $('xslcontent').value = defaultxsl;
        }
        else {
            $('xslcontent').value = this.defaultxsl;
        }

        try {
            $('xmlcontent').value = window.arguments[0]; // May cause an error if called from the Options dialog
        }
        catch (ignore) {
        }

        var progressmeter = $('progressmeter');
        progressmeter.style.display = 'none'; // In case CSS didn't work...

        
        // var contenttype = window.arguments[4]; // Not really needed

        this.strbundle = $('xslresults-strings');
                
        $('xsltabs').selectedIndex = 0;
        this.loadSitePrefsData();
    },
    fileChangeHandler : function (e) {
//              var that = this;
        var xslfilename = $('xslfile').value;
        if (xslfilename === '') {
            return;
        }

        if (xslfilename.substr(0, 7) === 'http://') {
            var progressmeter = $('progressmeter');
            var acceptbutton = document.documentElement.getButton('accept');
            var req = new XMLHttpRequest();
            req.open('GET', xslfilename, true);
            req.onreadystatechange = function () {
                if (req.readyState === 4) {
                    if (req.status === 200) {
                        // dump(req.responseText);
                        //that.finish(/*XSL file contents*/ req.responseXML, /* XML to xform*/ xmldata, cbo);
                        $('xslcontent').value = new XMLSerializer().serializeToString(req.responseXML);
                        //window.close();
                        progressmeter.style.display = 'none';
                        acceptbutton.disabled = false;
                        //return false;
                    }
                }
            };
            req.send(null);
        }
        else {
            if (xslfilename.substr(0, 8) === 'file:///') {
                xslfilename = xslfilename.replace(/file:\/\/\//, '');
                xslfilename = xslfilename.replace(/%20/g, ' ');
                xslfilename = xslfilename.replace(/\//g, "\\");
            }

            var xslfilename2 = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);

            xslfilename2.initWithPath(xslfilename);

            // First, get and initialize the converter
            var converter = Cc['@mozilla.org/intl/scriptableunicodeconverter']
                              .createInstance(Ci.nsIScriptableUnicodeConverter);
            converter.charset = 'UTF-8';

            // This assumes that 'file' is a variable that contains the file you want to read, as an nsIFile
            var fis = Cc['@mozilla.org/network/file-input-stream;1']
                        .createInstance(Ci.nsIFileInputStream);
            fis.init(xslfilename2, -1, -1, 0);

            var lis = fis.QueryInterface(Ci.nsILineInputStream);
            var lineData = {};
            var cont, line;
            var xsldoc = '';

            do {
                cont = lis.readLine(lineData);
                line = converter.ConvertToUnicode(lineData.value);
                xsldoc += line+'\n';
            } while (cont);

            fis.close();
            lis.close();

            $('xslcontent').value = xsldoc;
//            this.finish(xsldoc, xmldata, cbo);
            //progressmeter.style.display = 'none';
            //acceptbutton.disabled = false;
        //    return false;
        }
        $('xslcontent').focus();
        $('xslcontent').selectionStart = 0;
        $('xslcontent').selectionEnd = 0;
    },
    updateXMLPreStylesheet : function () {
        var currurl = window.opener.getBrowser().selectedBrowser.webNavigation.currentURI.spec;
        var that = this;
        var cb2 = function (buf) {
            var wininfo = that.performXSL.getWindowContent(window.opener);
            $('xmlcontent').value = buf;
            that.processDTD(wininfo.ctype);
        };
        that.performXSL.getPrestyleDoc(currurl, null, null, window.opener.content.characterSet, cb2);
    },
    updateXMLQueryWindow : function () {
        var wininfo = this.performXSL.getWindowContent(window.opener);
        $('xmlcontent').value = wininfo.content;
        this.processDTD(wininfo.ctype);
    },
    getUrlSpec : function (myfile) {
        // returns nsIFile for the given extension's file
        var url = this.addon.getResourceURI(myfile);
        return url.spec;
    },
    toggleOutputExt: function() {
		$('outputext').disabled = $('extensions.xslresults.open_where').selectedItem === $('open_textbox_only');
    },
    outputext : function(e) {
        var temp1 = Cc['@mozilla.org/pref-localizedstring;1'].createInstance(Ci.nsIPrefLocalizedString);
        temp1.data = e.target.value;
        this.branch.setComplexValue('outputext', Ci.nsIPrefLocalizedString, temp1);
    },
    processDTD : function (contenttype) {
        if ((contenttype === 'xml' && this.branch.getBoolPref('xmlstripdtd')) ||
            (contenttype === 'html' && this.branch.getBoolPref('htmlstripdtd'))) {
            this.stripDTD(); // Must come after line above
        }
        else if ($('xmlcontent').value.match(/<!DOCTYPE/)) {// give the choice if the preferences don't strip and if there is a doctype to strip
            $('stripdtd').className = 'visible';
//          alert('a');
        }
    },
    stripDTD: function() {
        var xmlbox = $('xmlcontent').value;
        xmlbox = xmlbox.replace(/<!DOCTYPE[^>\[]*\[[^\]]*\]>/g, '');
        $('xmlcontent').value = xmlbox.replace(/<!DOCTYPE[^>]*>/g, '');
    },
    converttohtml : function() { // No longer needed since converted in overlay.js
        var windowcode = $('xmlcontent').value.replace(
                /<([^!>\s]+)(\s|>)/g,
                function(tag, tagname, end) {
                    return '<'+tagname.toLowerCase()+end;
                }
            ).replace(
                // Will this work with CDATA? Seems to work ok because of Firefox's DOM conversion process...
                /<!DOCTYPE(\s+)([^>\s]*)([\s>])/,
                function (whole, ws1, root, ws2) {
                    return '<!DOCTYPE'+ws1+root.toLowerCase()+ws2;
                }
            ).replace(
                /<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD HTML 4\.01 Transitional\/\/EN">/,
                '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">'
            ).replace(/<!--(-*)([^>]*)[^>\-](-*)-->/g, '<!--$2-->'
            // Firefox allows comments with extra hyphens to display in HTML (including in its inner DOM representation), but will not be valid as XML.
            ).replace(/\s\)=""/g, '');
        $('xmlcontent').value = windowcode;
    },
    getprops: function(id) {
        var el = $(id);
        var prop;
        for (prop in el) {
            console.log(prop+'::: '+el[prop]);
        }
    },
    doOK : function() {
        this.fixSettings();
    },
    fixSettings : function() {
        // Remember XSL box contents for next time
        var temp = Cc['@mozilla.org/pref-localizedstring;1'].createInstance(Ci.nsIPrefLocalizedString);
        temp.data = $('xslcontent').value;
        this.branch.setComplexValue('defaultxsl', Ci.nsIPrefLocalizedString, temp);

        // Remember Window and splitter positions
        this.branch0.setIntPref('window.outer.height', window.outerHeight);
        this.branch0.setIntPref('window.outer.width', window.outerWidth);
        this.branch0.setIntPref('xmlcontentbox.width', $('xmlcontentbox').width);
        this.branch0.setIntPref('xmloutputbox.width', $('xmloutputbox').width);

        var xslbox_width = $('xslcontentbox').width;
        var xmlbox_width = $('xmlcontentbox').width;
        if (xslbox_width !== undefined) {
            this.branch0.setIntPref('textbox.xsl.width', xslbox_width);
        }
        if (xmlbox_width !== undefined) {
            this.branch0.setIntPref('textbox.xml.width', xmlbox_width);
        }
    },
    doTransform : function() {
        this.fixSettings();
        // Start progressmeter and disable accept button until failure or finished with execution
        var xml = $('xmlcontent').value;
        if (this.performXSL.testwellformed(xml)) {
                var progressmeter = $('progressmeter');
                progressmeter.style.display = 'block';
                var acceptbutton = document.documentElement.getButton('accept');
                acceptbutton.disabled = true;

                this.performXSL.execute_XSL();

                progressmeter.style.display = 'none';
                acceptbutton.disabled = false;
        }
        return false;
    },
    doCancel : function() {
        this.fixSettings();
        return this.checkForDups(this.xmlDoc);
    },
    // Note this is different from setprefs in charrefunicode (more flexible since radio not exclusively for booleans)
    setprefs: function(e) {
        switch (e.target.nodeName) {
            case 'checkbox':
                // Apparently hasn't changed yet, so use the opposite
                this.branch.setBoolPref(e.target.id.replace(/extensions.xslresults./, ''), !e.target.checked);
                break;
            case 'radio':
                var radioid;
                var result = e.target.id.match(/^_([0-9])+-(.*)$/);
                if (result !== null) {
                    radioid = result[2]; // Extract preference name
                    this.branch.setIntPref(radioid.replace(/extensions.xslresults./, ''), result[1]);
                }
                else {
                    this.branch.setCharPref(e.currentTarget.id.replace(/extensions.xslresults./, ''), e.target.id);
                }
                break;
            default:
                break;
        }
    },
    resetdefaults: function() {
        this.branch0.setIntPref('enginetype', 0);
        $('extensions.xslresults.enginetype').selectedIndex = 0;
        this.branch.setBoolPref('xmlstripdtd', true);
        this.branch.setBoolPref('htmlstripdtd', true);
        this.branch.setCharPref('open_where', 'open_tab');
                
        $('extensions.xslresults.xmlstripdtd').checked = true;
        $('extensions.xslresults.htmlstripdtd').checked = true;
        $('extensions.xslresults.open_where').selectedItem = $('extensions.xslresults.open_tab');
                
        $('outputext').value = 'xml';

        this.branch.setIntPref('xmlcontentbox.width', 0);
        this.branch.setIntPref('xmloutputbox.width', 0);

        // Remember XSL box contents for next time
        $('xslcontent').value = this.defaultxsl;
        var temp = Cc['@mozilla.org/pref-localizedstring;1'].createInstance(Ci.nsIPrefLocalizedString);
        temp.data = this.defaultxsl;
        this.branch.setComplexValue('defaultxsl', Ci.nsIPrefLocalizedString, temp);

    },
    checkForDups : function (doc) {
        if (typeof doc === 'string' && (!doc || doc.match(/^\s*$/))) {
            return true; // Nothing to check for
        }

        var urls = this.performXSL.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[2]/@label', doc, doc, this.performXSL.xulResolver);
        var enableds = this.performXSL.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[5]/@value', doc, doc, this.performXSL.xulResolver);

        var i, url, urlArray;
        for (i = 0, urlArray = []; i < urls.length; i++) {
            url = urls[i].value;
            if (urlArray[url] && enableds[i].value === 'true') {
                alert(this.strbundle.getString('extensions.xslresults.moreThanOneQuery'));
                return false;
            }
            if (enableds[i].value === 'true') {
                urlArray[url] = true;
            }
        }
        return true;
    },
    onUnLoad : function() {
        // Serialize XML for tree and save to file
        file_put_contents('xslresults_querydata.xml', this.serialize(this.xmlDoc));
                
        return this.checkForDups(this.xmlDoc);
    },
    // Adapted a portion of script from http://www.quirksmode.org/js/detect.html used here for OS detection

    xulns : 'http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul',
    htmlns : 'http://www.w3.org/1999/xhtml',
    performXSL : performXSL,
    cursormarker : '{$cursor}',
    defaultxsl : '<?xml version=\"1.0\" encoding=\"UTF-8\"?>'+"\n"+
        "<xsl:stylesheet version=\"1.0\" xmlns:xsl=\"http://www.w3.org/1999/XSL/Transform\"  xmlns:html=\"http://www.w3.org/1999/xhtml\">"+"\n"+
        "<xsl:output method=\"html\" version=\"1.0\" encoding=\"UTF-8\"/>"+"\n\n"+
        "<xsl:template match=\"/\">"+"\n"+
        "<html><body>"+"\n"+
        "<div><xsl:apply-templates/></div>"+"\n"+
        "</body></html>"+"\n"+
        "</xsl:template>"+"\n\n"+
        "</xsl:stylesheet>"
};
window.addEventListener('load', function(e) { performXSL.onLoad(e); executeXSL.onLoad(e); }, false);
window.addEventListener('unload', function(e) { executeXSL.onUnLoad(e); }, false);
