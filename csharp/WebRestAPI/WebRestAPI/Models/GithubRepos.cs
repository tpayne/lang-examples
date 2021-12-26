using System;
using System.Text.Json.Serialization;

namespace WebRestAPI.Models
{
    public class GithubRepos
    {
        [JsonPropertyName("name")]
        public string repoName { get; set; }
        [JsonPropertyName("clone_url")]
        public string repoUrl { get; set; }
        [JsonPropertyName("updated_at")]
        public string lastUpdate { get; set; }
        
    }
}
