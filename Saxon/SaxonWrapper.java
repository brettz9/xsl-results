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

/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

import net.sf.saxon.xqj.*;
import net.sf.saxon.javax.xml.xquery.*;
import java.util.Properties;


// import java.io.File;
import javax.xml.transform.stream.StreamSource;
import net.sf.saxon.s9api.*;
import java.io.*;

/**
 *
 * @author Brett Zamir
 */
public class SaxonWrapper {
    

    public String xform(String xsltext, String xmltext, /* 'html', etc. */ String method)  {

        if (method == null) {
            method = "html";
        }
        try {
            StreamSource streamSrcXSL = new StreamSource(new StringReader(xsltext));
            StreamSource streamSrcXML = new StreamSource(new StringReader(xmltext));

            Serializer serializer = new Serializer();

            // These three needed for outputting to string
            serializer.setOutputProperty(Serializer.Property.METHOD, method);
            StringWriter sw = new StringWriter();
            serializer.setOutputWriter(sw);

            Processor proc = new Processor(false);

            XsltCompiler compiler = proc.newXsltCompiler();
            try {
                XsltExecutable exec = compiler.compile(streamSrcXSL);
                try {
                    XsltTransformer xformer = exec.load();
                    try {
                        xformer.setSource(streamSrcXML);
                        // worked fine (when using serializer)
                        xformer.setDestination(serializer); 
                        xformer.transform();
                        // Added this for string storage
                        java.lang.System.out.println(sw.toString());
                        return sw.toString();
                    }
                    catch (Exception e) {
                        System.out.println(e.getMessage());
                        return e.getMessage();
                    }
                }
                catch (Exception e) {
                   System.out.println(e.getMessage());
                    return e.getMessage();
                }
            }
            catch (Exception e) {
                System.out.println(e.getMessage());
                 return e.getMessage();
            }
        
        }
        catch (Exception e) {
            return e.getMessage();
        }
        
    }
    
    
    public Object /*XQPreparedExpression*/ prepareExpression (XQConnection conn, String xquery) {
        try {
            return conn.prepareExpression(xquery);
        }
        catch (XQException e) {
            System.out.println(e.getMessage());
            return new ErrorObj(e.getMessage());
        }
        catch (Exception e) {
            System.out.println(e.getMessage());
            return new ErrorObj(e.getMessage());
        }
        
    }
    public Object /*XQResultSequence*/ executeQuery (XQPreparedExpression exp) {
        try {
            return exp.executeQuery();
        }
        catch (XQException e) {
            System.out.println(e.getMessage());
            return new ErrorObj(e.getMessage());
        }
        catch (Exception e) {
            System.out.println(e.getMessage());
            return new ErrorObj(e.getMessage());
        }
    }
    public String getItemAsString (SaxonXQForwardSequence fs, Properties prop) {
        try {
            return fs.getItemAsString(prop);
        }
        catch (Exception e) {
            System.out.println(e.getMessage());
            return "Sax err msg::"+e.getMessage();
        }
    }
    
    public class ErrorObj {
        
        public String err;
        
        public ErrorObj (String str) {
            this.err = str;
        }
    }
    
}