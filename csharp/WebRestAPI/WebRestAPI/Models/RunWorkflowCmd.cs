using System;
using System.Text.Json.Serialization;
using System.Collections.Generic;

namespace WebRestAPI.Models
{
    public class RunWorkflowsCmd
    {
        [JsonPropertyName("ref")]
        public string revisionId { get; set; }
        [JsonPropertyName("inputs")]
    	public Dictionary<string, string> parms { get; set; }
    }
}
