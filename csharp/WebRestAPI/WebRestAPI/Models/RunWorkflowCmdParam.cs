using System;
using System.Text.Json.Serialization;
using System.Collections.Generic;

namespace WebRestAPI.Models
{
    public class RunWorkflowsCmdParams
    {
        [JsonPropertyName("ref")]
        public string revisionId { get; set; }
        [JsonPropertyName("inputs")]
    	public Dictionary<string, string> parms { get; set; }
        
        // Accessors
        public void AddParam(string key, string value)
        {
            if (parms == null)
            {
                parms = new Dictionary<string, string>();
            }
            parms.Add(key,value);
        }
    }
}
