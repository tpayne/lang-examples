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
        public DateTime started_at { get; set; }
        public DateTime completed_at { get; set; }
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
        public int number { get; set; }
        public DateTime started_at { get; set; }
        public DateTime completed_at { get; set; }
    }
}
