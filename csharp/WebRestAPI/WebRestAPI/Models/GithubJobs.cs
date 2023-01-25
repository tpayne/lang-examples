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
    public class GithubJobs
    {
        [JsonPropertyName("total_count")]
        public int noJobs { get; set; }
        public List<Job> jobs { get; set; }
    }

    public class Job
    {
        public long id { get; set; }
        public long run_id { get; set; }
        public string workflow_name { get; set; }
        public string head_branch { get; set; }
        public string run_url { get; set; }
        public int run_attempt { get; set; }
        public string node_id { get; set; }
        public string head_sha { get; set; }
        public string url { get; set; }
        public string html_url { get; set; }
        public string status { get; set; }
        public string conclusion { get; set; }
        public string started_at { get; set; }
        public string completed_at { get; set; }        
        public string name { get; set; }
        public List<Step> steps { get; set; }
        public string check_run_url { get; set; }
        public List<string> labels { get; set; }
        public int runner_id { get; set; }
        public string runner_name { get; set; }
        public int runner_group_id { get; set; }
        public string runner_group_name { get; set; }
    }

    public class Step
    {
        public string name { get; set; }
        public string status { get; set; }
        public string conclusion { get; set; }
        public string started_at { get; set; }
        public string completed_at { get; set; }            
        public int number { get; set; }
    }
}
