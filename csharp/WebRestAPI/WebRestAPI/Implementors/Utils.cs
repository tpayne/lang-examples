/*
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

*/

using Microsoft.AspNetCore.Http;
using System.Net.Http;
using System.Net.Http.Headers;
using System.IO;
using System.Xml;
using Newtonsoft.Json;
using System.Xml.Linq;

namespace WebRestAPI.Implementors
{
    public class Utils
    {
        //
        // Public utility classes
        //
        
        public static string ConvertXMLToJson(string xml)
        {
            XmlDocument doc = new XmlDocument();
            string encodedXml = System.Security.SecurityElement.Escape(xml);
            doc.LoadXml(encodedXml);
            string json = JsonConvert.SerializeXmlNode(doc);
            return FormatJson(json);
        }

        public static string GetCreds(HttpRequest request)
        {
            var header = AuthenticationHeaderValue.Parse(request.Headers["Authorization"]);
            string creds = header.Parameter;
            return creds;
        }

        public static HttpClient GetHttpClient(string creds)
        {
            HttpClient client = new HttpClient();
            client.DefaultRequestHeaders.Accept.Clear();
            client.DefaultRequestHeaders.Accept.Add(
                new MediaTypeWithQualityHeaderValue("application/vnd.github.v3+json")
            );
            client.DefaultRequestHeaders.Add("User-Agent", ".NET Foundation Repository Reporter");
            client.DefaultRequestHeaders.Add("X-GitHub-Api-Version", "2022-11-28");
            client.DefaultRequestHeaders.Add("Authorization", "Bearer " + creds);

            return client;
        }

        public static string FormatJson(string json)
        {
            if (json == null)
            {
                return null;
            }
            dynamic parsedJson = JsonConvert.DeserializeObject(json);
            return JsonConvert.SerializeObject(parsedJson, Newtonsoft.Json.Formatting.Indented);
        }

        public static string FormatJson(Stream json)
        {
            if (json == null)
            {
                return null;
            }
            StreamReader reader = new StreamReader(json);
            string text = reader.ReadToEnd();
            dynamic parsedJson = JsonConvert.DeserializeObject(text);
            return JsonConvert.SerializeObject(parsedJson, Newtonsoft.Json.Formatting.Indented);
        }
    }
}
