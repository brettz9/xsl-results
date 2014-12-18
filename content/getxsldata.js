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
    charset = (!charset) ? 'UTF-8' : charset;

    var MY_ID = 'xslresults@brett.zamir';
    var em = Cc['@mozilla.org/extensions/manager;1'].getService(Ci.nsIExtensionManager);
    // the path may use forward slash ('/') as the delimiter

    if (typeof file === 'string') {
//                        var file = this.extdir.getItemFile(this.extid, filename);
        var tempfilename = file;
        file = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties).get('ProfD', Ci.nsILocalFile);
        file.append(tempfilename);
    }
    // var file = em.getInstallLocation(MY_ID).getItemFile(MY_ID, 'content/'+filename);

    if( !file.exists() ) {   // if it doesn't exist, create  // || !file.isDirectory()
            file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0777); // DIRECTORY_TYPE
    }
    // file.createUnique(Ci.nsIFile.NORMAL_FILE_TYPE, 0664); // for temporary

    var foStream = Cc['@mozilla.org/network/file-output-stream;1'].createInstance(Ci.nsIFileOutputStream);
    foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0); // use 0x02 | 0x10 to open file for appending.
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
        if (t.currentIndex == -1) {
            return;
        }
        try {
                t.view.setCellText(t.currentIndex, col, val);
        }
        catch(e) {
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
            catch (e) {
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
                '<treeitem xmlns="'+this.xulns+'"><treerow><treecell label="'+name+'"/><treecell label="'+url+'"/><treecell label="'+xsl+'"/>'+
                        '<treecell label="xml"/><treecell value="false"/><treecell value="false"/>'+
                                '</treerow></treeitem>' /* <treecell value="false"/><treecell value="false"/> */
              ).documentElement
        );

        var t = $('querytree');
        t.view.selection.select(t.view.rowCount-1);
        t.focus();
        this.updateView();
    },
    escapeXML : function (xml) {
        return xml.replace(/&/g, '&amp;').replace(/\</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/, '&apos;').replace(/\n/g, '\\\\n');
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
        if (t.currentIndex == -1) {
           return;
        }
        try {
           var url = t.view.getCellText(t.currentIndex, t.columns.getNamedColumn('queryurl'));
        }
        catch(e) {
            return;
        }
        $('xmlSitePref.url').value = url;
        var name = t.view.getCellText(t.currentIndex, t.columns.getNamedColumn('queryname'));
        $('xmlSitePref.name').value = name;
        // var xsl = t.view.getCellText(t.currentIndex, t.columns.getNamedColumn('queryxsl'));

        /*/
        for (var i=1, att; i <= 6; i++) {
               if (i === 3) {
                       continue; // XQueries may differ given whitespace (normalize XPath function?)
               }
               if (i <= 4) {
                       att = 'label';
               }
               else {
                       att = 'value';
               }
               var xqueries = this.performXSL.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell['+i+']/@'+att, document, t,
                                            this.performXSL.xulResolver);
               for (var j=0; j < xqueries.length; j++) {
                       xqueries[j].nodeValue === ;
               }
        }
        */
        var xsl = this.docEvaluate('//xul:treeitem/xul:treerow[xul:treecell[1]/@label = "'+name+'" and xul:treecell[2]/@label = "'+url+'"]/xul:treecell['+3+']/@label', document, t,
                                            this.performXSL.xulResolver);
        /*/for (var i=0; i < xqueries.length; i++) {
        alert(xqueries[i].nodeValue);
        }
        */
        $('xmlSitePref.xsl').value = xsl.nodeValue.replace(/\\\\n/g, '\n');
        //*/
        //$('treechildren');
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

        // var filecontents = this.performXSL.loadfile('content/querydata.xml');
        //alert(filecontents);
        // var treechildren = new XML(filecontents.replace(/^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/, ''));
        //              this.xmlDoc = document.implementation.createDocument('', 'test', null);
        //              this.xmlDoc.load('querydata.xml');

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
    docEvaluate : function (expr, doc, context, resolver) {
        doc = doc ? doc : document;
        resolver = resolver ? resolver : null;
        context = context ? context : doc;

        var result = doc.evaluate(expr, context, resolver, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
/*/                var a = [];
        for(var i = 0; i < result.snapshotLength; i++) {
                a[i] = result.snapshotItem(i);
        }
        return a;*/
        return result.snapshotItem(0);
    },
    sortFields : {},
    sort : function (col) {
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
        java.lang.System.out.println(str);
    },
    onLoad: function(e) {
        var that = this;
        $('querytree').addEventListener('blur', function(e) {that.populateSitePrefBoxes(e.target);}, true);

        // Set window size to that set last time hit 'ok''
        this.prefs0 = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefBranch);
        this.prefs = Cc['@mozilla.org/preferences-service;1'].getService(Ci.nsIPrefService);
        // This branch must be set in both the properties file and prefs js file: http://developer.mozilla.org/en/docs/Code_snippets:Preferences#nsIPrefLocalizedString
        this.branch = this.prefs.getBranch('extensions.xslresults.');

        $('outputext').value = this.branch.getComplexValue('outputext', Ci.nsIPrefLocalizedString).data;

        // Might be able to change some of these to @persist?
        var outerh = this.prefs0.getIntPref('extensions.xslresults.window.outer.height');
        var outerw = this.prefs0.getIntPref('extensions.xslresults.window.outer.width');
        if (outerh > 0) {
            window.outerHeight = outerh;
        }
        if (outerw > 0) {
            window.outerWidth = outerw;
        }

        var outputw = this.prefs0.getIntPref('extensions.xslresults.xmlcontentbox.width');
        var outputw2 = this.prefs0.getIntPref('extensions.xslresults.xmloutputbox.width');
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

        if (this.prefs0.getIntPref('extensions.xslresults.textbox.xsl.width') > 0) {
            $('xslcontentbox').width = this.prefs0.getIntPref('extensions.xslresults.textbox.xsl.width');
        }
        if (this.prefs0.getIntPref('extensions.xslresults.textbox.xml.width') > 0) {
            $('xmlcontentbox').width = this.prefs0.getIntPref('extensions.xslresults.textbox.xml.width');
        }

        $('extensions.xslresults.enginetype').selectedIndex = this.prefs.getIntPref('extensions.xslresults.enginetype');


        $('extensions.xslresults.applyXSLT').checked = this.prefs.getBoolPref('extensions.xslresults.applyXSLT');
        $('extensions.xslresults.applyXSLT2').checked = this.prefs.getBoolPref('extensions.xslresults.applyXSLT2');
                
        $('extensions.xslresults.xmlstripdtd').checked = this.prefs.getBoolPref('extensions.xslresults.xmlstripdtd');
        $('extensions.xslresults.htmlstripdtd').checked = this.prefs.getBoolPref('extensions.xslresults.htmlstripdtd');
        $('extensions.xslresults.open_where').selectedItem = $(this.prefs.getCharPref('extensions.xslresults.open_where'));
        if ($('extensions.xslresults.open_where').selectedItem === $('open_textbox_only')) {
            $('outputext').disabled = true;
        }

        // this.OS = this.searchString(this.dataOS);
        // this.OSfile_slash = (this.OS === 'Windows') ? '\\' : '/'; // The following doesn't seem to auto-convert forward slashes to backslashes, so this is needed (though why is there no problem in overlay.js for Windows? Probably since only being used there for Java)
        // this.path = Cc['@mozilla.org/file/directory_service;1'].getService( Ci.nsIProperties).get('ProfD', Ci.nsIFile).path; // Get path to user profile folder
        //this.extpath = this.path+this.OSfile_slash+'extensions'+this.OSfile_slash+'xslresults@brett.zamir'+this.OSfile_slash;

        // From http://developer.mozilla.org/en/docs/Code_snippets:File_I/O
        this.extid = 'xslresults@brett.zamir'; // the extension's id from install.rdf
        var em = Cc['@mozilla.org/extensions/manager;1'].
                            getService(Ci.nsIExtensionManager);
        // the path may use forward slash ('/') as the delimiter
        this.extdir = em.getInstallLocation(this.extid);

        //alert(this.extdir.getItemFile(this.extid, 'SaxonWrapper').exists()); // gives nsIFile

        $('helppanel').setAttribute('src', this.getUrlSpec('readme.xhtml'));

        // Fix: Could get rid of this OS detection code

        /* Since hard-wiring now, don't need preferences (also ensures if migrating a profile, that it will still work on a different machine */
        /*
        var Saxonjardirtype = '0jardir_'+this.OS;

        var Saxonjardir = this.branch.getComplexValue(Saxonjardirtype,
                        Ci.nsIPrefLocalizedString).data;
        if (Saxonjardir == '' || Saxonjardir == ' ') {
            var temp = Cc['@mozilla.org/pref-localizedstring;1']
                    .createInstance(Ci.nsIPrefLocalizedString);
            temp.data = this.getUrlSpec('SaxonWrapper'); // this.extpath+'SaxonWrapper'+this.OSfile_slash;
            this.prefs.setComplexValue('extensions.xslresults.'+Saxonjardirtype, Ci.nsIPrefLocalizedString, temp);
            Saxonjardir = temp.data;
        }
        $('SaxonJarfiles').value = Saxonjardir;
        */
        this.processDTD(ctype);
                
        var defaultxsl = this.branch.getComplexValue('defaultxsl', Ci.nsIPrefLocalizedString).data;

        if (defaultxsl != ' ' && defaultxsl != '') {
            $('xslcontent').value = defaultxsl;
        }
        else {
            $('xslcontent').value = this.defaultxsl;
        }

        try {
            $('xmlcontent').value = window.arguments[0]; // May cause an error if called from the Options dialog
        }
        catch (e) {
        }

        var progressmeter = $('progressmeter');
        progressmeter.style.display = 'none'; // In case CSS didn't work...

        var ctype = window.arguments[3];
        var contenttype = window.arguments[4]; // Not really needed

        this.performXSL.loader_saxon = window.arguments[1];
        var furl = window.arguments[2];

        if (this.performXSL.loader_saxon && furl) {
            this.policyAdd(this.performXSL.loader_saxon, furl);
        }

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
            req.onreadystatechange = function (aEvt) {
                if (req.readyState == 4) {
                    if(req.status == 200) {
                        // dump(req.responseText);
                        //that.finish(/*XSL file contents*/ req.responseXML, /* XML to xform*/ xmldata, cbo);
                        $('xslcontent').value = new XMLSerializer().serializeToString(req.responseXML);
                        //window.close();
                        progressmeter.style.display = 'none';
                        acceptbutton.disabled = false;
                        //return false;
                    }
                }
                else {
                /*        alert('Error loading page\n'); */
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
            var cont;
            var xsldoc = '';

            do {
                cont = lis.readLine(lineData);
                var line = converter.ConvertToUnicode(lineData.value);
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
        var file = this.extdir.getItemFile(this.extid, myfile);
        var ios = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService);
        var url = ios.newFileURI(file);
        return url.spec;
    },
    toggleOutputExt: function() {
		$('outputext').disabled = ($('extensions.xslresults.open_where').selectedItem === $('open_textbox_only'))
    },
    outputext : function(e) {
        var temp1 = Cc['@mozilla.org/pref-localizedstring;1'].createInstance(Ci.nsIPrefLocalizedString);
        temp1.data = e.target.value;
        this.prefs.setComplexValue('extensions.xslresults.outputext', Ci.nsIPrefLocalizedString, temp1);
    },
    processDTD : function (contenttype) {
        if ((contenttype === 'xml' && this.prefs.getBoolPref('extensions.xslresults.xmlstripdtd')) ||
            (contenttype === 'html' && this.prefs.getBoolPref('extensions.xslresults.htmlstripdtd'))) {
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
    /*/
    jarchange : function(e) {
        var temp1 = Cc['@mozilla.org/pref-localizedstring;1']
                    .createInstance(Ci.nsIPrefLocalizedString);
        temp1.data = e.target.value;
        // extensions.xslresults.0jardir_Windows
        if (e.target.val == undefined) { // If not set in JS, then get value from XUL
            e.target.val = e.target.getAttribute('val');
        }

        this.prefs.setComplexValue('extensions.xslresults.'+e.target.val+'jardir_'+this.OS,
                      Ci.nsIPrefLocalizedString, 
                      temp1);

        if (!e.target.notrigger) { // Used in JS above
            var c = confirm(this.strbundle.getString('extensions.xslresults.restartjarchange'));
            if (c) {
                var startup = Ci.nsIAppStartup;
                Cc['@mozilla.org/toolkit/app-startup;1'].getService(startup).quit(startup.eRestart | startup.eAttemptQuit);
            }
        }
    },
    */
    converttohtml : function() { // No longer needed since converted in overlay.js
        var windowcode = $('xmlcontent').value;
        windowcode = windowcode.replace(
            /<([^!>\s]+)(\s|>)/g,
            function(tag, tagname, end) {
                return '<'+tagname.toLowerCase()+end;
            }
        ); // Will this work with CDATA? Seems to work ok because of Firefox's DOM conversion process...
        windowcode = windowcode.replace(
            /<!DOCTYPE(\s+)([^>\s]*)([\s>])/,
            function (whole, ws1, root, ws2) {
                return '<!DOCTYPE'+ws1+root.toLowerCase()+ws2;
            }
        );
        // Overcome a few known obfuscation techniques used at some sites to prevent querying:
        windowcode = windowcode.replace(
            /<!DOCTYPE html PUBLIC "-\/\/W3C\/\/DTD HTML 4\.01 Transitional\/\/EN">/,
            '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">'
        );
        windowcode = windowcode.replace(/<!--(-*)([^>]*)[^>-](-*)-->/g, '<!--$2-->'); // Firefox allows comments with extra hyphens to display in HTML (including in its inner DOM representation), but will not be valid as XML.
        windowcode = windowcode.replace(/\s\)=""/g, '');
        $('xmlcontent').value = windowcode;
    },
    getprops: function(id) {
        var el = $(id);
        for (var prop in el) {
//            if (abc !== 'mInputField' && abc !== 'maxLength' && abc !== 'size' && abc !== 'nodeValue' && abc !== 'firstChild' && abc !== 'lastChild' && abc !== 'prefix' && abc !== 'database' && abc !== 'builder') {
                java.lang.System.out.println(prop+'::: '+el[prop]);
//            }
        }
    },
    doOK : function() {
        this.fixSettings();
    },
    fixSettings : function() {
        // Remember XSL box contents for next time
        var temp = Cc['@mozilla.org/pref-localizedstring;1'].createInstance(Ci.nsIPrefLocalizedString);
        temp.data = $('xslcontent').value;
        this.prefs.setComplexValue('extensions.xslresults.defaultxsl', Ci.nsIPrefLocalizedString, temp);

        // Remember Window and splitter positions
        this.prefs0.setIntPref('extensions.xslresults.window.outer.height', window.outerHeight);
        this.prefs0.setIntPref('extensions.xslresults.window.outer.width', window.outerWidth);
        this.prefs0.setIntPref('extensions.xslresults.xmlcontentbox.width', $('xmlcontentbox').width);
        this.prefs0.setIntPref('extensions.xslresults.xmloutputbox.width', $('xmloutputbox').width);

        var xslbox_width = $('xslcontentbox').width;
        var xmlbox_width = $('xmlcontentbox').width;
        if (xslbox_width !== undefined) {
            this.prefs0.setIntPref('extensions.xslresults.textbox.xsl.width', xslbox_width);
        }
        if (xmlbox_width !== undefined) {
            this.prefs0.setIntPref('extensions.xslresults.textbox.xml.width', xmlbox_width);
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
                this.prefs.setBoolPref(e.target.id, Boolean(!e.target.checked));
                break;
            case 'radio':
                var radioid;
                var result = e.target.id.match(/^_([0-9])+-(.*)$/);
                if (result !== null) {
                    radioid = result[2]; // Extract preference name
                    this.prefs.setIntPref(radioid, result[1]);
                }
                else {
                    this.prefs.setCharPref(e.currentTarget.id, e.target.id);
                }
                break;
            default:
                break;
        }
    },
    applyXSLT : function (e) {
        this.setprefs(e);
        if (this.prefs.getBoolPref('extensions.xslresults.applyXSLT') === true) {
    //                        $('extensions.xslresults.applyXSLT2').checked = true;
                $('extensions.xslresults.applyXSLT2').disabled = true;
        }
        else {
                $('extensions.xslresults.applyXSLT2').disabled = false;
        }
        return false;
    },
    resetdefaults: function() {
        this.prefs0.setIntPref('extensions.xslresults.enginetype', 0);
        $('extensions.xslresults.enginetype').selectedIndex = 0;
        this.prefs.setBoolPref('extensions.xslresults.xmlstripdtd', true);
        this.prefs.setBoolPref('extensions.xslresults.htmlstripdtd', true);
        this.prefs.setCharPref('extensions.xslresults.open_where', 'open_tab');
        this.prefs.setBoolPref('extensions.xslresults.applyXSLT', false);
        this.prefs.setBoolPref('extensions.xslresults.applyXSLT2', true);
                
        $('extensions.xslresults.xmlstripdtd').checked = true;
        $('extensions.xslresults.htmlstripdtd').checked = true;
        $('extensions.xslresults.open_where').selectedItem = $('extensions.xslresults.open_tab');
        $('extensions.xslresults.applyXSLT2').checked = true;
        $('extensions.xslresults.applyXSLT').checked = false;
        $('extensions.xslresults.applyXSLT2').disabled = false;
                
        $('outputext').value = 'xml';

        this.prefs.setIntPref('extensions.xslresults.xmlcontentbox.width', 0);
        this.prefs.setIntPref('extensions.xslresults.xmloutputbox.width', 0);

        // Remember XSL box contents for next time
        $('xslcontent').value = this.defaultxsl;
        var temp = Cc['@mozilla.org/pref-localizedstring;1'].createInstance(Ci.nsIPrefLocalizedString);
        temp.data = this.defaultxsl;
        this.prefs.setComplexValue('extensions.xslresults.defaultxsl', Ci.nsIPrefLocalizedString, temp);

        /* Not needed since hard-wiring
        var sax1 = $('SaxonJarfiles').value;
        var saxon_val = this.getUrlSpec('SaxonWrapper'); // this.extpath+'SaxonWrapper'+this.OSfile_slash;
        $('SaxonJarfiles').value = saxon_val;
                 if (saxon_val != sax1) { // || bdbxml_val != bdb1) {
            var ev4 = {target: {value: saxon_val, val: '0'}};
            this.jarchange(ev4);
        }
        */
    },
    checkForDups : function (doc) {
        if (typeof doc === 'string' && (!doc || doc.match(/^\s*$/))) {
            return true; // Nothing to check for
        }

        var urls = this.performXSL.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[2]/@label', doc, doc, this.performXSL.xulResolver);
/*/    var xsls = this.performXSL.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[3]/@label', doc, doc, 
                                this.performXSL.xulResolver);
        var fileexts = this.performXSL.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[4]/@label', doc, doc,
                                this.performXSL.xulResolver);*/
        var enableds = this.performXSL.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[5]/@value', doc, doc, this.performXSL.xulResolver);
//     var prestyles = this.performXSL.docEvaluateArray('//xul:treeitem/xul:treerow/xul:treecell[6]/@value', doc, doc, this.performXSL.xulResolver);

        for (var i=0, urlArray=[]; i < urls.length; i++) {
            var url = urls[i].nodeValue;
            if (urlArray[url] && enableds[i].nodeValue === 'true') {
                    alert(this.strbundle.getString('extensions.xslresults.moreThanOneQuery'));
                    return false;
            }
            if (enableds[i].nodeValue === 'true') {
                    urlArray[url] = true;
            }
            // var regexp = new RegExp('^'  +  RegExp.escape(url).replace(/\*/, '.*')   +  '\/?$',  '');
        }
        return true;
    },
    onUnLoad : function(e) {
        // Serialize XML for tree and save to file
//      alert(this.xmlDoc);
        file_put_contents ('xslresults_querydata.xml', this.serialize(this.xmlDoc));
                
        return this.checkForDups(this.xmlDoc);
  //              alert(this.serialize(this.xmlDoc));
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
}
window.addEventListener('load', function(e) { performXSL.onLoad(e); executeXSL.onLoad(e); }, false);
window.addEventListener('unload', function(e) { executeXSL.onUnLoad(e); }, false);
