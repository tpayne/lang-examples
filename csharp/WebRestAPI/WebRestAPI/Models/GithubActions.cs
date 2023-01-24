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

using System;
using System.Text.Json.Serialization;
using System.Collections.Generic;

namespace WebRestAPI.Models
{
    public class GitHubActions
    {
        [JsonPropertyName("total_count")]
        public int noActions { get; set; }
        public List<Workflow> workflows { get; set; }
    }

    public class Workflow
    {
        [JsonPropertyName("id")]
        public int workflowId { get; set; }
        [JsonPropertyName("name")]
        public string workflowName { get; set; }
        [JsonPropertyName("path")]
        public string pathName { get; set; }
        [JsonPropertyName("url")]
        public string url { get; set; }
        [JsonPropertyName("state")]
        public string status { get; set; }
        [JsonPropertyName("html_url")]
        public string htlmUrl { get; set; }
        [JsonPropertyName("created_at")]
        public DateTime createDate { get; set; }
        [JsonPropertyName("updated_at")]
        public DateTime updateDate { get; set; }
    }
}
