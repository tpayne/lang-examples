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
